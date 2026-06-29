package dto

type ChatInviteRequest struct {
	To          string `json:"to"`
	InviteURL   string `json:"inviteUrl"`
	InviterName string `json:"inviterName"`
}
