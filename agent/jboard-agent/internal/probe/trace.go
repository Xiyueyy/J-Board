package probe

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"strings"
	"time"

	"github.com/jboard/jboard-agent/internal/config"
)

// Traceroute targets — same as latency targets
var traceTargets = []struct {
	Carrier string
	IP      string
}{
	{"telecom", "219.141.136.12"},
	{"mobile", "211.136.25.153"},
	{"unicom", "210.22.70.3"},
}

type hopDetail struct {
	Hop     int     `json:"hop"`
	IP      string  `json:"ip"`
	Geo     string  `json:"geo"`
	Latency float64 `json:"latency"`
}

type traceResult struct {
	Carrier  string      `json:"carrier"`
	Hops     []hopDetail `json:"hops"`
	Summary  string      `json:"summary"`
	HopCount int         `json:"hopCount"`
}

type tracePayload struct {
	Traces []traceResult `json:"traces"`
}

// nexttrace JSON output structures
type ntHop struct {
	Success bool `json:"Success"`
	Address *struct {
		IP string `json:"IP"`
	} `json:"Address"`
	Geo *struct {
		Asnumber string `json:"asnumber"`
		Country  string `json:"country"`
		Prov     string `json:"prov"`
		City     string `json:"city"`
		Owner    string `json:"owner"`
		Isp      string `json:"isp"`
	} `json:"Geo"`
	TTL int   `json:"TTL"`
	RTT int64 `json:"RTT"` // nanoseconds
}

type ntOutput struct {
	Hops [][]ntHop `json:"Hops"`
}

// TraceLoop periodically runs traceroute to three carriers and pushes to J-Board.
func TraceLoop(ctx context.Context, cfg *config.Config) {
	ticker := time.NewTicker(cfg.TraceInterval)
	defer ticker.Stop()

	// Run immediately
	traceAndPush(cfg)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			traceAndPush(cfg)
		}
	}
}

func traceAndPush(cfg *config.Config) {
	log.Println("[trace] starting trace cycle")

	var results []traceResult
	for _, target := range traceTargets {
		hops, summary, err := runTrace(target.IP)
		if err != nil {
			log.Printf("[trace] %s (%s): %v", target.Carrier, target.IP, err)
			continue
		}
		results = append(results, traceResult{
			Carrier:  target.Carrier,
			Hops:     hops,
			Summary:  summary,
			HopCount: len(hops),
		})
		log.Printf("[trace] %s: %s (%d hops)", target.Carrier, summary, len(hops))
	}

	if len(results) == 0 {
		log.Println("[trace] no results, skipping upload")
		return
	}

	payload := tracePayload{Traces: results}
	body, _ := json.Marshal(payload)

	if err := postToServer(cfg, "/api/agent/trace", body); err != nil {
		log.Printf("[trace] push error: %v — retrying in 10s", err)
		time.Sleep(10 * time.Second)
		if err := postToServer(cfg, "/api/agent/trace", body); err != nil {
			log.Printf("[trace] retry failed: %v", err)
		}
	}
}

func runTrace(ip string) ([]hopDetail, string, error) {
	cmd := exec.Command("nexttrace", "-j", "--no-color", "-n", ip)
	out, err := cmd.Output()
	if err != nil {
		return nil, "", fmt.Errorf("nexttrace failed for %s: %w", ip, err)
	}

	var parsed ntOutput
	if err := json.Unmarshal(out, &parsed); err != nil {
		return nil, "", fmt.Errorf("parse nexttrace output for %s: %w", ip, err)
	}

	var hops []hopDetail
	var asnumbers []string
	for i, hopGroup := range parsed.Hops {
		hop := hopDetail{Hop: i + 1}
		for _, probe := range hopGroup {
			if probe.Success && probe.Address != nil && probe.Address.IP != "" {
				hop.IP = probe.Address.IP
				hop.Latency = float64(probe.RTT) / 1e6
				if probe.Geo != nil {
					var parts []string
					if probe.Geo.Country != "" {
						parts = append(parts, probe.Geo.Country)
					}
					if probe.Geo.Prov != "" {
						parts = append(parts, probe.Geo.Prov)
					}
					if probe.Geo.City != "" {
						parts = append(parts, probe.Geo.City)
					}
					if probe.Geo.Owner != "" {
						parts = append(parts, probe.Geo.Owner)
					}
					hop.Geo = strings.Join(parts, " ")
					if probe.Geo.Asnumber != "" {
						asnumbers = append(asnumbers, probe.Geo.Asnumber)
					}
				}
				break
			}
		}
		hops = append(hops, hop)
	}

	// Hide the first hop (server gateway IP) for security
	if len(hops) > 0 {
		hops[0].IP = "*"
		hops[0].Geo = ""
	}

	summary := detectSummary(hops, asnumbers)
	return hops, summary, nil
}

func detectSummary(hops []hopDetail, asnumbers []string) string {
	combined := ""
	for _, h := range hops {
		combined += " " + strings.ToUpper(h.Geo)
	}
	asSet := ""
	for _, asn := range asnumbers {
		asSet += " " + asn
	}

	switch {
	case strings.Contains(combined, "CN2") && strings.Contains(combined, "GIA"):
		return "CN2 GIA"
	case strings.Contains(combined, "CN2"):
		return "CN2 GT"
	case strings.Contains(asSet, "9929") || strings.Contains(combined, "CUII") || strings.Contains(combined, "A网"):
		return "AS9929"
	case strings.Contains(asSet, "4837"):
		return "AS4837"
	case strings.Contains(combined, "CMI") || strings.Contains(asSet, "58453"):
		return "CMI"
	case strings.Contains(combined, "CMIN2") || strings.Contains(asSet, "59807"):
		return "CMIN2"
	default:
		return "普通线路"
	}
}
