package probe

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/jboard/jboard-agent/internal/config"
)

type netSpeedPayload struct {
	InboundBps    uint64 `json:"inboundBps"`
	OutboundBps   uint64 `json:"outboundBps"`
	InterfaceName string `json:"interfaceName,omitempty"`
	SampledAt     string `json:"sampledAt"`
}

type netCounters struct {
	RxBytes       uint64
	TxBytes       uint64
	InterfaceName string
}

// NetSpeedLoop periodically samples host network counters and pushes whole-machine speed.
func NetSpeedLoop(ctx context.Context, cfg *config.Config) {
	interval := cfg.NetSpeedInterval
	if interval <= 0 {
		interval = 10 * time.Second
	}

	previous, err := readNetCounters(cfg.NetSpeedInterface)
	if err != nil {
		log.Printf("[net-speed] initial read error: %v", err)
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			current, err := readNetCounters(cfg.NetSpeedInterface)
			if err != nil {
				log.Printf("[net-speed] read error: %v", err)
				continue
			}
			if previous.RxBytes == 0 && previous.TxBytes == 0 {
				previous = current
				continue
			}

			seconds := interval.Seconds()
			if seconds <= 0 {
				seconds = 1
			}

			rxDelta := uint64(0)
			txDelta := uint64(0)
			if current.RxBytes >= previous.RxBytes {
				rxDelta = current.RxBytes - previous.RxBytes
			}
			if current.TxBytes >= previous.TxBytes {
				txDelta = current.TxBytes - previous.TxBytes
			}

			payload := netSpeedPayload{
				InboundBps:    uint64(float64(rxDelta) / seconds),
				OutboundBps:   uint64(float64(txDelta) / seconds),
				InterfaceName: current.InterfaceName,
				SampledAt:     time.Now().Format(time.RFC3339),
			}
			previous = current

			body, _ := json.Marshal(payload)
			if err := postToServer(cfg, "/api/agent/system-metrics", body); err != nil {
				log.Printf("[net-speed] push error: %v", err)
			}
		}
	}
}

func readNetCounters(preferredInterface string) (netCounters, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return netCounters{}, err
	}
	defer file.Close()

	preferredInterface = strings.TrimSpace(preferredInterface)
	var fallback []netCounters
	var selected []netCounters

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.Contains(line, ":") {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		iface := strings.TrimSpace(parts[0])
		fields := strings.Fields(parts[1])
		if len(fields) < 16 {
			continue
		}

		rxBytes, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			continue
		}
		txBytes, err := strconv.ParseUint(fields[8], 10, 64)
		if err != nil {
			continue
		}

		counter := netCounters{RxBytes: rxBytes, TxBytes: txBytes, InterfaceName: iface}
		if preferredInterface != "" {
			if iface == preferredInterface {
				return counter, nil
			}
			continue
		}

		if iface != "lo" {
			fallback = append(fallback, counter)
		}
		if isPhysicalTrafficInterface(iface) {
			selected = append(selected, counter)
		}
	}
	if err := scanner.Err(); err != nil {
		return netCounters{}, err
	}

	if preferredInterface != "" {
		return netCounters{}, fmt.Errorf("interface %s not found", preferredInterface)
	}
	if len(selected) == 0 {
		selected = fallback
	}
	if len(selected) == 0 {
		return netCounters{}, fmt.Errorf("no network interface found")
	}

	var total netCounters
	var names []string
	for _, counter := range selected {
		total.RxBytes += counter.RxBytes
		total.TxBytes += counter.TxBytes
		names = append(names, counter.InterfaceName)
	}
	total.InterfaceName = strings.Join(names, ",")
	return total, nil
}

func isPhysicalTrafficInterface(iface string) bool {
	if iface == "lo" || iface == "" {
		return false
	}
	for _, prefix := range []string{"docker", "br-", "veth", "virbr", "cni", "flannel", "kube", "zt", "tailscale"} {
		if strings.HasPrefix(iface, prefix) {
			return false
		}
	}

	operstate, err := os.ReadFile(filepath.Join("/sys/class/net", iface, "operstate"))
	if err == nil {
		state := strings.TrimSpace(string(operstate))
		if state == "down" || state == "lowerlayerdown" || state == "notpresent" {
			return false
		}
	}

	return true
}
