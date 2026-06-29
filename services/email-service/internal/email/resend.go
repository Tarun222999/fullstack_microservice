package email

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"io"
	"net/http"
	"time"
)

type ResendSender struct {
	apiKey     string
	httpClient *http.Client
}

type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
	Text    string   `json:"text"`
}

type resendEmailResponse struct {
	ID string `json:"id"`
}

func NewResendSender(apiKey string) *ResendSender {
	return &ResendSender{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (s *ResendSender) SendChatInvite(ctx context.Context, invite types.ChatInviteEmail) (string, error) {
	requestBody := resendEmailRequest{
		From:    invite.From,
		To:      []string{invite.To},
		Subject: RenderSubject(invite),
		HTML:    RenderHTMLInvite(invite),
		Text:    RenderPlainTextInvite(invite),
	}

	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(requestBody); err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.resend.com/emails", &body)
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	responseBody, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("resend returned status %d: %s", res.StatusCode, string(responseBody))
	}

	var resendResponse resendEmailResponse
	if err := json.Unmarshal(responseBody, &resendResponse); err != nil {
		return "", err
	}

	if resendResponse.ID == "" {
		return "", errors.New("resend response missing id")
	}

	return resendResponse.ID, nil
}
