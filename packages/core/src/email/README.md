# Email

How Lintel sends email: password resets, invitations, form notifications. Features call
one thing:

```ts
await server.email.send({
  to: "ana@example.com", // or a list
  subject: "You've been invited",
  text: "Plain text, always", // html is optional
  html: "<p>...</p>",
});
```

`send` checks the message (`email.schema.ts`), fills in the sender from `EMAIL_FROM` and
hands it to the driver chosen by `EMAIL_DRIVER`. Problems throw named errors whose message
says what to check: `InvalidEmailError` for a bad message, `EmailNotSentError` when the
service refused or couldn't be reached.

Emails a request shouldn't wait on or fail over (invitations, password resets, security
notices) go through `sendEmail(server, message)` (`send-email.ts`), which doesn't wait and
never throws; a failure is logged. That keeps answers such as "if that address has an
account, we've sent a link" the same whether or not an email went out. Automations' "Send
an email" step awaits `server.email.send` instead, so a failed send shows in the run.

## The outbox

Until `EMAIL_DRIVER` names a real service, emails are kept in the outbox instead of being
sent: in `<LINTEL_FOLDER>/outbox` when Lintel runs, and in memory in tests. Admins read the
newest under **Settings → Email outbox** (`GET /email/outbox`, `settings:read`), which is how
links in invitations and password resets are followed on a computer with no mail server.
`server.emailOutbox` is the outbox driver, or null with a real one; tests use its
`latestTo(address)`.

## Drivers

| `EMAIL_DRIVER`     | Sends through                              | Needs                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------- |
| `outbox` (default) | Nothing: kept in `.lintel/outbox/*.json`   | Nothing                                     |
| `smtp`             | Any SMTP server (SES, Mailgun, Gmail, ...) | `SMTP_HOST`, usually `SMTP_USER` + password |
| `resend`           | resend.com's HTTP API                      | `RESEND_API_KEY`                            |
| `postmark`         | postmarkapp.com's HTTP API                 | `POSTMARK_SERVER_TOKEN`                     |

Every real driver also needs `EMAIL_FROM` on a domain the service has verified. The
outbox is the default so that development and fresh installs never email anyone by
mistake; a production server logs a warning while it is in use. Tests get an outbox in
memory from `buildServer` and read `driver.sent`.

`pnpm send-test-email --to you@example.com` sends one email with the current settings.

Adding a driver: one class implementing `EmailDriver` (`send(email)`), a case in
`configured-email.ts`, its settings in `email.config.ts`.

## Files

| File                       | What it does                                         |
| -------------------------- | ---------------------------------------------------- |
| `email.schema.ts`          | The message shape, and what drivers receive          |
| `email.service.ts`         | `EmailSender`: checks, fills in, hands to the driver |
| `email-driver.ts`          | The driver interface                                 |
| `smtp-email-driver.ts`     | SMTP, with nodemailer                                |
| `resend-email-driver.ts`   | Resend                                               |
| `postmark-email-driver.ts` | Postmark                                             |
| `http-email-request.ts`    | Posting to an HTTP API and explaining refusals       |
| `outbox-email-driver.ts`   | Keeping emails instead of sending them               |
| `email.config.ts`          | The settings and their rules                         |
| `configured-email.ts`      | The driver and sender the settings ask for           |
| `email.errors.ts`          | Named errors                                         |
| `index.ts`                 | What other features may import                       |
| `send-email.ts`            | `sendEmail`: send without waiting, log failures      |
| `outbox.service.ts`        | Describing the outbox for Settings → Email outbox    |
| `email.routes.ts`          | `GET /email/outbox`                                  |
