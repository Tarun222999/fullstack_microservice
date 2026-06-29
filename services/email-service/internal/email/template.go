package email

import (
	"fmt"
	"github.com/Tarun222999/fullstack_microservice/services/email-service/internal/types"
	"html"
	"strings"
)

func RenderSubject(invite types.ChatInviteEmail) string {
	inviterName := strings.TrimSpace(invite.InviterName)
	if inviterName == "" {
		return fmt.Sprintf("You were invited to %s", invite.AppName)
	}

	return fmt.Sprintf("%s invited you to %s", inviterName, invite.AppName)
}

func RenderPlainTextInvite(invite types.ChatInviteEmail) string {
	inviterName := strings.TrimSpace(invite.InviterName)
	if inviterName == "" {
		return fmt.Sprintf("You were invited to a private room on %s.\n\nThis private room expires in 10 minutes.\n\nOpen this link to join:\n%s\n", invite.AppName, invite.InviteURL)
	}

	return fmt.Sprintf("%s invited you to a private room on %s.\n\nThis private room expires in 10 minutes.\n\nOpen this link to join:\n%s\n", inviterName, invite.AppName, invite.InviteURL)
}

func RenderHTMLInvite(invite types.ChatInviteEmail) string {
	brand := withBrandDefaults(invite.Brand)
	appName := html.EscapeString(invite.AppName)
	inviterName := html.EscapeString(strings.TrimSpace(invite.InviterName))
	inviteURL := html.EscapeString(invite.InviteURL)

	intro := fmt.Sprintf("You were invited to a private room on %s.", appName)
	if inviterName != "" {
		intro = fmt.Sprintf("%s invited you to a private room on %s.", inviterName, appName)
	}

	return fmt.Sprintf(`<!doctype html>
<html>
  <body style="margin:0;padding:0;background:%[1]s;color:%[4]s;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;">
    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:%[1]s;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="max-width:560px;background:%[2]s;border:1px solid %[6]s;border-radius:10px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <div style="color:%[3]s;font-size:24px;letter-spacing:10px;font-weight:700;text-transform:uppercase;">PULSE</div>
                <div style="color:%[5]s;font-size:12px;letter-spacing:7px;text-transform:uppercase;margin-top:14px;">Personal &bull; Private &bull; AI</div>
                <h1 style="margin:34px 0 18px 0;color:%[4]s;font-size:32px;line-height:1.15;font-weight:800;">You have a private room waiting.</h1>
                <p style="margin:0;color:%[5]s;font-size:16px;line-height:1.7;">%[7]s</p>
                <div style="margin:24px 0 0 0;padding:14px 16px;border-left:3px solid %[3]s;background:rgba(0,230,118,0.08);color:%[4]s;font-size:15px;line-height:1.6;">
                  This private chat expires in <strong style="color:%[3]s;">10 minutes</strong>.
                </div>
                <a href="%[8]s" style="display:inline-block;margin-top:28px;padding:14px 18px;background:%[3]s;color:%[1]s;text-decoration:none;border-radius:8px;font-size:15px;font-weight:800;">Enter private chat -&gt;</a>
                <p style="margin:28px 0 0 0;color:%[5]s;font-size:12px;line-height:1.6;">If the button does not work, open this link:<br><span style="color:%[4]s;word-break:break-all;">%[8]s</span></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`, brand.BackgroundColor, brand.SurfaceColor, brand.PrimaryColor, brand.TextColor, brand.MutedColor, brand.BorderColor, intro, inviteURL)
}

func withBrandDefaults(brand types.Brand) types.Brand {
	if brand.PrimaryColor == "" {
		brand.PrimaryColor = "#00e676"
	}
	if brand.BackgroundColor == "" {
		brand.BackgroundColor = "#05080d"
	}
	if brand.SurfaceColor == "" {
		brand.SurfaceColor = "#0a0f14"
	}
	if brand.TextColor == "" {
		brand.TextColor = "#f8fafc"
	}
	if brand.MutedColor == "" {
		brand.MutedColor = "#8b95a7"
	}
	if brand.BorderColor == "" {
		brand.BorderColor = "#173526"
	}

	return brand
}
