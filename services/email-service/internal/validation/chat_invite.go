package validation

import (
	"errors"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/dto"
	"net/mail"
	"net/url"
	"strings"
)

func ChatInvite(payload dto.ChatInviteRequest) error {
	to := strings.TrimSpace(payload.To)
	if to == "" {
		return errors.New("to is required")
	}

	address, err := mail.ParseAddress(to)
	if err != nil || address.Address != to {
		return errors.New("to must be a valid email address")
	}

	inviteURL := strings.TrimSpace(payload.InviteURL)
	if inviteURL == "" {
		return errors.New("inviteUrl is required")
	}

	parsedURL, err := url.ParseRequestURI(inviteURL)
	if err != nil {
		return errors.New("inviteUrl must be a valid URL")
	}

	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return errors.New("inviteUrl must use http or https")
	}

	if parsedURL.Host == "" {
		return errors.New("inviteUrl must be an absolute URL")
	}

	if len(strings.TrimSpace(payload.InviterName)) > 120 {
		return errors.New("inviterName must be 120 characters or less")
	}

	return nil
}
