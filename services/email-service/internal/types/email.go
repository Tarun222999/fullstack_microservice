package types

import "context"

type ChatInviteEmail struct {
	To          string
	InviteURL   string
	InviterName string
	From        string
	AppName     string
}

type EmailSender interface {
	SendChatInvite(ctx context.Context, invite ChatInviteEmail) (string, error)
}
