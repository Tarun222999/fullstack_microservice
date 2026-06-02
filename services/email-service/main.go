package main

import (
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/config"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/email"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/server"
	"log"
	"net/http"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("email-service config error: %v", err)
	}

	api := server.New(cfg, email.NewResendSender(cfg.ResendAPIKey))
	addr := fmt.Sprintf(":%s", cfg.Port)

	log.Printf("email-service listening on %s", addr)
	if err := http.ListenAndServe(addr, api.Routes()); err != nil {
		log.Fatalf("email-service stopped: %v", err)
	}
}
