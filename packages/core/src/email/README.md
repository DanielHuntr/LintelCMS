# Email

A deliberately tiny interface for sending email: `EmailSender.send({ to, subject, text })`.
Features that send email (the "Send an email" step in `src/workflows`) take an
`EmailSender` and never know how mail leaves the server.

Until a mail driver exists, `LoggingEmailSender` writes each message to the server log.
Tests use `RecordingEmailSender` and read `sent`. A real driver implements the same
interface and is passed in through `buildServer({ workflows: { email } })`.

| File              | What it does                                |
| ----------------- | ------------------------------------------- |
| `email-sender.ts` | The interface, the logging and test senders |
