package config

import (
	"log"
	"os"
	"strconv"
	"time"
)

type Config struct {
	ServerURL string
	AuthToken string

	LatencyInterval time.Duration
	TraceInterval   time.Duration
}

func Load() *Config {
	cfg := &Config{
		ServerURL:       envOrDefault("SERVER_URL", ""),
		AuthToken:       envOrDefault("AUTH_TOKEN", ""),
		LatencyInterval: envDuration("LATENCY_INTERVAL", 5*time.Minute),
		TraceInterval:   envDuration("TRACE_INTERVAL", 30*time.Minute),
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
