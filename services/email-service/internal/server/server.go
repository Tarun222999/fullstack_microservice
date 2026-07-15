package server

import (
	"encoding/json"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/config"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/dto"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/observability"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/validation"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"log"
	"net/http"
	"strings"
)

const InternalTokenHeader = "X-Internal-Token"

type Server struct {
	config config.Config
	sender types.EmailSender
}

func New(config config.Config, sender types.EmailSender) *Server {
	return &Server{config: config, sender: sender}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.Handle(
		"POST /emails/chat-invite",
		otelhttp.NewHandler(
			http.HandlerFunc(s.requireInternalAuth(s.handleChatInvite)),
			"POST /emails/chat-invite",
		),
	)
	return mux
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "email-service",
	})
}

func (s *Server) handleChatInvite(w http.ResponseWriter, r *http.Request) {
	var payload dto.ChatInviteRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if err := validation.ChatInvite(payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	id, err := s.sender.SendChatInvite(r.Context(), types.ChatInviteEmail{
		To:          strings.TrimSpace(payload.To),
		InviteURL:   strings.TrimSpace(payload.InviteURL),
		InviterName: strings.TrimSpace(payload.InviterName),
		From:        s.config.EmailFrom,
		AppName:     s.config.AppName,
		Brand:       s.config.Brand,
	})
	if err != nil {
		logContext := observability.ContextForLog(r.Context())
		log.Printf(
			"failed to send chat invite email trace_id=%s span_id=%s error=%v",
			logContext.TraceID,
			logContext.SpanID,
			err,
		)
		writeError(w, http.StatusBadGateway, "Email provider request failed")
		return
	}

	writeJSON(w, http.StatusOK, map[string]map[string]string{
		"data": {
			"id": id,
		},
	})
}
