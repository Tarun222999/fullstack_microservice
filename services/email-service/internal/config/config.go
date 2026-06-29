package config

import (
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"os"
	"strings"
)

type Config struct {
	Port          string
	InternalToken string
	ResendAPIKey  string
	EmailFrom     string
	AppName       string
	Brand         types.Brand
}

func Load() (Config, error) {
	config := Config{
		Port:          envOrDefault("PORT", envOrDefault("EMAIL_SERVICE_PORT", "4004")),
		InternalToken: strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN")),
		ResendAPIKey:  strings.TrimSpace(os.Getenv("RESEND_API_KEY")),
		EmailFrom:     strings.TrimSpace(os.Getenv("EMAIL_FROM")),
		AppName:       envOrDefault("APP_NAME", "Pulse Chat"),
		Brand: types.Brand{
			PrimaryColor:    envOrDefault("BRAND_PRIMARY_COLOR", "#00e676"),
			BackgroundColor: envOrDefault("BRAND_BACKGROUND_COLOR", "#05080d"),
			SurfaceColor:    envOrDefault("BRAND_SURFACE_COLOR", "#0a0f14"),
			TextColor:       envOrDefault("BRAND_TEXT_COLOR", "#f8fafc"),
			MutedColor:      envOrDefault("BRAND_MUTED_COLOR", "#8b95a7"),
			BorderColor:     envOrDefault("BRAND_BORDER_COLOR", "#173526"),
		},
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
