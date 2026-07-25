package main

import (
	"context"
	"errors"
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/config"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/email"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/observability"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/server"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("email-service config error: %v", err)
	}

	ctx := context.Background()
	shutdownTelemetry, err := observability.Start(ctx, "email-service")
	if err != nil {
		log.Printf("failed to start OpenTelemetry; continuing without telemetry: %v", err)
		shutdownTelemetry = func(context.Context) error { return nil }
	}

	api := server.New(cfg, email.NewResendSender(cfg.ResendAPIKey))
	addr := fmt.Sprintf(":%s", cfg.Port)
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           api.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	shutdownCtx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	log.Printf("email-service listening on %s", addr)
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-shutdownCtx.Done()
		log.Print("shutting down email-service")

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := httpServer.Shutdown(ctx); err != nil {
			log.Printf("error shutting down http server: %v", err)
		}
		if err := shutdownTelemetry(ctx); err != nil {
			log.Printf("error shutting down telemetry: %v", err)
		}
	}()

	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("email-service stopped: %v", err)
	}
	<-shutdownDone
}
