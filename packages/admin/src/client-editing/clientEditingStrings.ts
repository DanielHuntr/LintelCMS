/** Content-only editing's words (see README.md). Spread into i18n/strings.ts. */
export const clientEditingStrings = {
  "clientEditing.sendForReview": "Send for review",
  "clientEditing.sending": "Sending…",
  "clientEditing.waiting": "Waiting for review",
  "clientEditing.sentAnnouncement": "Sent for review. The site team will check your changes.",
  "clientEditing.sentBack.title": "Sent back by {name}",
  "clientEditing.sentBack.someone": "the site team",
  "clientEditing.approved": "Approved and live",

  "clientEditing.setting.title": "Clients’ changes",
  "clientEditing.setting.description":
    "People with the Client (content only) role change the words, pictures and links you open up for them.",
  "clientEditing.setting.goLive": "Go live when they publish",
  "clientEditing.setting.needsApproval": "Wait for approval",
  "clientEditing.setting.saved": "Saved",

  "clientEditing.widget.title": "Waiting for review",
  "clientEditing.widget.description": "Clients’ changes to check before they go live.",
  "clientEditing.widget.emptyTitle": "Nothing waiting",
  "clientEditing.widget.emptyDescription": "Changes clients send for review show up here.",
  "clientEditing.widget.detail": "{collection} · sent by {name}",
  "clientEditing.widget.approve": "Approve",
  "clientEditing.widget.sendBack": "Send back",
  "clientEditing.widget.approved": "Approved. {title} is live.",
  "clientEditing.widget.sentBack": "Sent back to {name}.",
  "clientEditing.sendBack.title": "Send back “{title}”",
  "clientEditing.sendBack.description":
    "Their changes stay saved, and nothing changes on the site.",
  "clientEditing.sendBack.note": "What should they change?",
  "clientEditing.sendBack.confirm": "Send back",
  "clientEditing.sendBack.cancel": "Cancel",
  "clientEditing.filter.waiting": "Waiting for review",
} as const;
