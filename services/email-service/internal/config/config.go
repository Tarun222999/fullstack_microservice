package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port          string
	InternalToken string
	ResendAPIKey  string
	EmailFrom     string
	AppName       string
}

func Load() (Config, error) {
	config := Config{
		Port:          envOrDefault("EMAIL_SERVICE_PORT", "4004"),
		InternalToken: strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN")),
		ResendAPIKey:  strings.TrimSpace(os.Getenv("RESEND_API_KEY")),
		EmailFrom:     strings.TrimSpace(os.Getenv("EMAIL_FROM")),
		AppName:       envOrDefault("APP_NAME", "Chat App"),
	}

	var missing []string
	if config.InternalToken == "" {
		missing = append(missing, "INTERNAL_API_TOKEN")
	}
	if config.ResendAPIKey == "" {
		missing = append(missing, "RESEND_API_KEY")
	}
	if config.EmailFrom == "" {
		missing = append(missing, "EMAIL_FROM")
	}

	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
	}

	return config, nil
}

func envOrDefault(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
