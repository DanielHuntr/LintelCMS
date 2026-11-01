# Email outbox

Settings → Email outbox (`/settings/email-outbox`): while no mail service is set up, the API
keeps the emails it would have sent in memory (see `packages/core/src/email`), and this page
shows them with their links clickable. That is how invitations and password resets are
followed on a development computer.

| File                  | What it does |
| --------------------- | ------------ |
| `EmailOutboxPage.tsx` | The page     |
| `emailOutbox.api.ts`  | The API call |
