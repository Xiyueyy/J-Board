package probe

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"time"

	"github.com/jboard/jboard-agent/internal/config"
)

const defaultUpgradeScriptURL = "https://raw.githubusercontent.com/Xiyueyy/J-Board/main/scripts/upgrade-jboard-agent.sh"

type agentCommandEnvelope struct {
	Command *agentCommand `json:"command"`
}

type agentCommand struct {
	ID      string            `json:"id"`
	Type    string            `json:"type"`
	Payload map[string]string `json:"payload"`
}

type agentCommandReport struct {
	ID      string `json:"id"`
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

// CommandLoop polls J-Board for node-side maintenance commands.
// The upgrade command is deliberately spawned in the background because the
// upgrade script restarts this systemd service and would otherwise kill the
// reporting request before it returns.
func CommandLoop(ctx context.Context, cfg *config.Config) {
	interval := cfg.AgentCommandInterval
	if interval <= 0 {
		interval = 30 * time.Second
	}

	timer := time.NewTimer(10 * time.Second)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			pollAndHandleCommand(cfg)
			timer.Reset(interval)
		}
	}
}

func pollAndHandleCommand(cfg *config.Config) {
	cmd, err := pollAgentCommand(cfg)
	if err != nil {
		log.Printf("[command] poll error: %v", err)
		return
	}
	if cmd == nil {
		return
	}

	log.Printf("[command] received %s command %s", cmd.Type, cmd.ID)
	status := "SUCCEEDED"
	message := "command accepted"

	switch cmd.Type {
	case "UPGRADE_AGENT":
		if err := spawnAgentUpgrade(cmd.Payload["scriptUrl"]); err != nil {
			status = "FAILED"
			message = err.Error()
		} else {
			message = "agent upgrade started in background; see /var/log/jboard-agent-upgrade.log"
		}
	default:
		status = "FAILED"
		message = "unsupported command type: " + cmd.Type
	}

	if err := reportAgentCommand(cfg, cmd.ID, status, message); err != nil {
		log.Printf("[command] report error: %v", err)
	}
}

func pollAgentCommand(cfg *config.Config) (*agentCommand, error) {
	req, err := http.NewRequest("GET", cfg.ServerURL+"/api/agent/commands", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+cfg.AuthToken)

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &httpError{StatusCode: resp.StatusCode}
	}

	var envelope agentCommandEnvelope
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return nil, err
	}
	return envelope.Command, nil
}

func reportAgentCommand(cfg *config.Config, id string, status string, message string) error {
	body, _ := json.Marshal(agentCommandReport{ID: id, Status: status, Message: message})
	req, err := http.NewRequest("POST", cfg.ServerURL+"/api/agent/commands", bytes.NewReader(body))
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

func spawnAgentUpgrade(scriptURL string) error {
	if strings.TrimSpace(scriptURL) == "" {
		scriptURL = defaultUpgradeScriptURL
	}
	if !strings.HasPrefix(scriptURL, "https://") {
		return fmt.Errorf("upgrade script url must be https")
	}
	if _, err := exec.LookPath("curl"); err != nil {
		return fmt.Errorf("curl not found: %w", err)
	}

	upgradeCommand := fmt.Sprintf("sleep 2; curl -fsSL %s | bash", shellQuote(scriptURL))
	detachedCommand := fmt.Sprintf("nohup sh -c %s >/var/log/jboard-agent-upgrade.log 2>&1 </dev/null &", shellQuote(upgradeCommand))
	return exec.Command("sh", "-c", detachedCommand).Run()
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}
