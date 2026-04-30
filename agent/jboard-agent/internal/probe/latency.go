package probe

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"time"

	"github.com/jboard/jboard-agent/internal/config"
)

// Jiangxi and Shanghai three-carrier TCP ping targets (Chinese ISP backbone nodes).
// Carrier ids are region-prefixed to keep Jiangxi and Shanghai measurements separate.
var latencyTargets = []struct {
	Carrier string
	Host    string
	Port    string
}{
	{"jx_telecom", "jx-ct-v4.ip.zstaticcdn.com", "80"},
	{"jx_unicom", "jx-cu-v4.ip.zstaticcdn.com", "80"},
	{"jx_mobile", "jx-cm-v4.ip.zstaticcdn.com", "80"},
	{"sh_telecom", "sh-ct-v4.ip.zstaticcdn.com", "80"},
	{"sh_unicom", "sh-cu-v4.ip.zstaticcdn.com", "80"},
	{"sh_mobile", "sh-cm-v4.ip.zstaticcdn.com", "80"},
}

type latencyEntry struct {
	Carrier   string `json:"carrier"`
	LatencyMs int    `json:"latencyMs"`
}

type latencyPayload struct {
	Latencies []latencyEntry `json:"latencies"`
}

// LatencyLoop periodically measures TCP ping latency to three carriers and pushes to J-Board.
func LatencyLoop(ctx context.Context, cfg *config.Config) {
	ticker := time.NewTicker(cfg.LatencyInterval)
	defer ticker.Stop()

	// Run immediately
	measureAndPush(cfg)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			measureAndPush(cfg)
		}
	}
}

func measureAndPush(cfg *config.Config) {
	var entries []latencyEntry

	for _, target := range latencyTargets {
		ms := tcpPing(target.Host, target.Port)
		if ms >= 0 {
			entries = append(entries, latencyEntry{
				Carrier:   target.Carrier,
				LatencyMs: ms,
			})
			log.Printf("[latency] %s: %dms", target.Carrier, ms)
		} else {
			log.Printf("[latency] %s: timeout", target.Carrier)
		}
	}

	if len(entries) == 0 {
		return
	}

	payload := latencyPayload{Latencies: entries}
	body, _ := json.Marshal(payload)

	if err := postToServer(cfg, "/api/agent/latency", body); err != nil {
		log.Printf("[latency] push error: %v", err)
	}
}

// tcpPing measures TCP handshake latency in milliseconds. Returns -1 on failure.
// The DNS lookup is intentionally performed before timing starts, matching
// classic probe panels such as Komari, so DNS jitter is not mixed into latency.
func tcpPing(host, port string) int {
	const (
		timeout              = 3 * time.Second
		highLatencyThreshold = 1000
		highLatencyRetries   = 3
	)

	ip, err := resolveIP(host)
	if err != nil {
		return -1
	}

	latency, err := measureTCPConnect(ip, port, timeout)
	if err != nil {
		return -1
	}
	best := latency

	if latency > highLatencyThreshold {
		for i := 0; i < highLatencyRetries; i++ {
			retryLatency, retryErr := measureTCPConnect(ip, port, timeout)
			if retryErr != nil {
				continue
			}
			if retryLatency < best {
				best = retryLatency
			}
			if retryLatency <= highLatencyThreshold {
				break
			}
		}
	}

	return best
}

func resolveIP(host string) (string, error) {
	if ip := net.ParseIP(host); ip != nil {
		return host, nil
	}

	addrs, err := net.LookupHost(host)
	if err != nil || len(addrs) == 0 {
		return "", errors.New("failed to resolve target")
	}

	return addrs[0], nil
}

func measureTCPConnect(ip string, port string, timeout time.Duration) (int, error) {
	start := time.Now()
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(ip, port), timeout)
	if err != nil {
		return -1, err
	}
	conn.Close()
	return int(time.Since(start).Milliseconds()), nil
}

func postToServer(cfg *config.Config, path string, body []byte) error {
	req, err := http.NewRequest("POST", cfg.ServerURL+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.AuthToken)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &httpError{StatusCode: resp.StatusCode}
	}
	return nil
}

type httpError struct {
	StatusCode int
}

func (e *httpError) Error() string {
	return "server returned " + http.StatusText(e.StatusCode)
}
