package email

import (
	"strings"
	"testing"

	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
)

func TestRenderPlainTextInviteIncludesExpiry(t *testing.T) {
	body := RenderPlainTextInvite(types.ChatInviteEmail{
		AppName:     "Pulse Chat",
		InviterName: "dude@gmail.com",
		InviteURL:   "https://pulse.example/private/room/abc",
	})

	for _, expected := range []string{
		"dude@gmail.com invited you to a private room on Pulse Chat.",
		"This private room expires in 10 minutes.",
		"https://pulse.example/private/room/abc",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected plain text body to include %q, got %q", expected, body)
		}
	}
}

func TestRenderHTMLInviteMatchesPulseBrand(t *testing.T) {
	body := RenderHTMLInvite(types.ChatInviteEmail{
		AppName:     "Pulse Chat",
		InviterName: "dude@gmail.com",
		InviteURL:   "https://pulse.example/private/room/abc",
		Brand: types.Brand{
			PrimaryColor:    "#00e676",
			BackgroundColor: "#05080d",
			SurfaceColor:    "#0a0f14",
			TextColor:       "#f8fafc",
			MutedColor:      "#8b95a7",
			BorderColor:     "#173526",
		},
	})

	for _, expected := range []string{
		"PULSE",
		"Personal &bull; Private &bull; AI",
		"You have a private room waiting.",
		"dude@gmail.com invited you to a private room on Pulse Chat.",
		"expires in <strong style=\"color:#00e676;\">10 minutes</strong>",
		"Enter private chat -&gt;",
		"https://pulse.example/private/room/abc",
	} {
		if !strings.Contains(body, expected) {
			t.Fatalf("expected html body to include %q", expected)
		}
	}
}

func TestRenderHTMLInviteEscapesUserContent(t *testing.T) {
	body := RenderHTMLInvite(types.ChatInviteEmail{
		AppName:     "Pulse Chat",
		InviterName: `<script>alert("x")</script>`,
		InviteURL:   `https://pulse.example/private/room/abc?x=<script>`,
	})

	if strings.Contains(body, "<script>") {
		t.Fatalf("expected html body to escape script tags")
	}
	if !strings.Contains(body, "&lt;script&gt;") {
		t.Fatalf("expected escaped script text in html body")
	}
}
