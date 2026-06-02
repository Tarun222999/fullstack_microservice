package email

import (
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"strings"
)

func RenderPlainTextInvite(invite types.ChatInviteEmail) string {
	inviterName := strings.TrimSpace(invite.InviterName)
	if inviterName == "" {
		return fmt.Sprintf("You were invited to chat on %s.\n\nOpen this link to join:\n%s\n", invite.AppName, invite.InviteURL)
	}

	return fmt.Sprintf("%s invited you to chat on %s.\n\nOpen this link to join:\n%s\n", inviterName, invite.AppName, invite.InviteURL)
}
