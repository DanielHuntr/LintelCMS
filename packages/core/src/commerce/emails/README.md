# Order emails

Three emails, in plain text and simple HTML (`order-emails.ts`): **Order #1001 confirmed**,
**Order #1001 is on its way** (with tracking) and **Refund for order #1001**. They're sent
after the change is saved; a failure is logged and noted on the order's timeline, never
undoing anything.

Sending goes through `EmailProvider` (`email-provider.ts`). The default, the outbox, keeps
each email in `shop_outbox_emails` instead of sending it, to be read in the admin under
Shop → Settings → Emails. To send real email, pass a provider as
`buildServer({ commerce: { emailProvider } })`.

Endpoints: `GET /shop/emails` (with which provider is in use) and `GET /shop/emails/:id`.
