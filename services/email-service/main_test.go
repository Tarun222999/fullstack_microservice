package main

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/config"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/server"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeSender struct {
	id      string
	err     error
	invites []types.ChatInviteEmail
}

func (s *fakeSender) SendChatInvite(_ context.Context, invite types.ChatInviteEmail) (string, error) {
	s.invites = append(s.invites, invite)
	if s.err != nil {
		return "", s.err
	}
	return s.id, nil
}

func testServer(sender *fakeSender) http.Handler {
	api := server.New(config.Config{
		Port:          "4004",
		InternalToken: "test-token",
		ResendAPIKey:  "test-resend-key",
		EmailFrom:     "Chat App <invites@example.com>",
		AppName:       "Chat App",
	}, sender)

	return api.Routes()
}

func TestHealth(t *testing.T) {
	handler := testServer(&fakeSender{id: "email-id"})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}
}

func TestChatInviteRequiresInternalToken(t *testing.T) {
	handler := testServer(&fakeSender{id: "email-id"})
	req := httptest.NewRequest(http.MethodPost, "/emails/chat-invite", bytes.NewBufferString(`{}`))
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, res.Code)
	}
}

func TestChatInviteValidatesRequest(t *testing.T) {
	handler := testServer(&fakeSender{id: "email-id"})
	body := bytes.NewBufferString(`{"to":"not-an-email","inviteUrl":"https://app.example.com/invite/abc"}`)
	req := httptest.NewRequest(http.MethodPost, "/emails/chat-invite", body)
	req.Header.Set(server.InternalTokenHeader, "test-token")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, res.Code)
	}
}

func TestChatInviteSendsEmail(t *testing.T) {
	sender := &fakeSender{id: "resend-id"}
	handler := testServer(sender)
	body := bytes.NewBufferString(`{"to":"friend@example.com","inviteUrl":"https://app.example.com/invite/abc","inviterName":"Tarun"}`)
	req := httptest.NewRequest(http.MethodPost, "/emails/chat-invite", body)
	req.Header.Set(server.InternalTokenHeader, "test-token")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, res.Code)
	}

	if len(sender.invites) != 1 {
		t.Fatalf("expected 1 invite, got %d", len(sender.invites))
	}

	invite := sender.invites[0]
	if invite.To != "friend@example.com" {
		t.Fatalf("expected invite to friend@example.com, got %s", invite.To)
	}
	if invite.InviteURL != "https://app.example.com/invite/abc" {
		t.Fatalf("expected invite url to be forwarded, got %s", invite.InviteURL)
	}
	if invite.InviterName != "Tarun" {
		t.Fatalf("expected inviter name Tarun, got %s", invite.InviterName)
	}

	var payload map[string]map[string]string
	if err := json.Unmarshal(res.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response is not valid json: %v", err)
	}
	if payload["data"]["id"] != "resend-id" {
		t.Fatalf("expected response id resend-id, got %s", payload["data"]["id"])
	}
}
