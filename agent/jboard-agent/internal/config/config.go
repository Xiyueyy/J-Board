package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	ServerURL string
	AuthToken string

	LatencyInterval      time.Duration
	TraceInterval        time.Duration
	NetSpeedInterval     time.Duration
	NetSpeedInterface    string
	AgentCommandInterval time.Duration

	XrayAccessLogPath string
	XrayLogStateFile  string
	XrayLogInterval   time.Duration
	XrayLogStartAtEnd bool
}

func Load() *Config {
	cfg := &Config{
		ServerURL:            envOrDefault("SERVER_URL", ""),
		AuthToken:            envOrDefault("AUTH_TOKEN", ""),
		LatencyInterval:      envDuration("LATENCY_INTERVAL", 5*time.Minute),
		TraceInterval:        envDuration("TRACE_INTERVAL", 30*time.Minute),
		NetSpeedInterval:     envDuration("NET_SPEED_INTERVAL", 3*time.Second),
		NetSpeedInterface:    envOrDefault("NET_SPEED_INTERFACE", ""),
		AgentCommandInterval: envDuration("AGENT_COMMAND_INTERVAL", 30*time.Second),
		XrayAccessLogPath:    envOrDefault("XRAY_ACCESS_LOG_PATH", ""),
		XrayLogStateFile:     envOrDefault("XRAY_LOG_STATE_FILE", "/var/lib/jboard-agent/xray-log-state.json"),
		XrayLogInterval:      envDuration("XRAY_LOG_INTERVAL", time.Minute),
		XrayLogStartAtEnd:    envBool("XRAY_LOG_START_AT_END", true),
	}

	if cfg.ServerURL == "" || cfg.AuthToken == "" {
		log.Fatal("[config] SERVER_URL and AUTH_TOKEN are required")
	}

	return cfg
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	if d, err := time.ParseDuration(v); err == nil {
		return d
	}

	if seconds, err := strconv.Atoi(v); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}

	return fallback
}

func envBool(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}

	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}
