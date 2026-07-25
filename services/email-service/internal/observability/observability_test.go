package observability

import (
	"context"
	"testing"
)

func TestTelemetryIsDisabledByDefault(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "")

	if isEnabled() {
		t.Fatal("expected telemetry to be disabled when OTEL_ENABLED is absent or empty")
	}
}

func TestTelemetryEnablementIsExplicitAndCaseInsensitive(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "TrUe")

	if !isEnabled() {
		t.Fatal("expected telemetry to be enabled when OTEL_ENABLED=true")
	}
}

func TestStartSkipsExporterSetupWhenTelemetryIsDisabled(t *testing.T) {
	t.Setenv("OTEL_ENABLED", "false")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:1")

	shutdown, err := Start(context.Background(), "email-service")
	if err != nil {
		t.Fatalf("expected disabled telemetry startup to succeed, got %v", err)
	}
	if shutdown == nil {
		t.Fatal("expected disabled telemetry startup to return a no-op shutdown function")
	}
	if err := shutdown(context.Background()); err != nil {
		t.Fatalf("expected no-op shutdown to succeed, got %v", err)
	}
}
