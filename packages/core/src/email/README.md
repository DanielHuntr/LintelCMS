# Email

The one way features send email: `server.email.sendEmail({ to, subject, text, replyTo? })`.
Forms use it for "new submission" notifications and for the optional confirmation sent to
the person who filled the form in.

## Senders

| File              | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `email-sender.ts` | `EmailMessage` and the `EmailSender` interface                     |
| `dev-outbox.ts`   | `DevOutbox`: keeps messages in memory and logs them; sends nothing |

`buildServer` takes an `email` option; without one it uses a `DevOutbox` that writes each
message to the server log, so nothing leaves a development machine by accident. Tests pass
their own `DevOutbox` and read `outbox.sent`.

Messages are plain text only. A real sender (SMTP, or a service such as Postmark) is a class
that implements `EmailSender`, handed to `buildServer`; nothing else needs to change.
