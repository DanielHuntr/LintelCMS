# Email

How Lintel sends email, kept deliberately small: one message shape, one sender interface
and one function to call.

```ts
sendEmail(server, { to: "ana@example.com", subject: "Reset your password", text: "..." });
```

`sendEmail` doesn't wait and never throws; failures are logged. That keeps answers such
as "if that address has an account, we've sent a link" the same whether or not an email
went out.

## Senders

`buildServer({ email })` takes any `EmailSender` (`send(message): Promise<void>`). Without
one, the server uses `OutboxEmailSender`, which keeps the last 50 messages in memory instead
of delivering them. Admins read them under **Settings → Email outbox**, which is how links
in invitations and password resets are followed on a computer with no mail server.
A delivering sender (SMTP or an email service) plugs in here.

## Endpoints

| Method and path     | Permission      | Success                                                          |
| ------------------- | --------------- | ---------------------------------------------------------------- |
| `GET /email/outbox` | `settings:read` | 200 `{ enabled, messages: [{ id, to, subject, text, sentAt }] }` |

`enabled` is false when a real sender is in use.

## Files

| File                     | What it does                                      |
| ------------------------ | ------------------------------------------------- |
| `email.ts`               | `EmailMessage`, `EmailSender` and `sendEmail`     |
| `outbox-email-sender.ts` | The in-memory sender used until one is configured |
| `email.service.ts`       | Describing the outbox for the API                 |
| `email.routes.ts`        | `GET /email/outbox`                               |

There is no repository: the outbox lives in memory, not in the database.
