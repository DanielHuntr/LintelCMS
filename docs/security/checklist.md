# Security checklist for features in progress

Check a feature against its section, and the general list, before it is merged. Tick what
it does; anything left unticked needs a reason in the pull request. The background is in
[threat-model.md](threat-model.md).

## Every feature

- [ ] Every new route is guarded by `requirePermission` or `requireSignedIn`, or added to
      `PUBLIC_ROUTES` in `packages/core/src/auth/route-access.test.ts` with its reason.
      Delivery routes (`/delivery/...`) use `requireDeliveryAccess`.
- [ ] New permissions are added to `src/roles/permissions.ts`, and API tokens only get them
      if a website really needs them (`src/api-tokens/api-token-access.ts`).
- [ ] Every body, query and params object goes through a Zod schema in `parseRequest`;
      services write only the columns they choose (no spreading request bodies into rows).
- [ ] Ids from the request are looked up with the parent they belong to (an entry's
      revision, a webhook's delivery, an order's line), not on their own.
- [ ] Every new table has `tenantId()`, and every new query filters on it.
- [ ] Nothing the server sends can run as HTML in the admin: no `dangerouslySetInnerHTML`
      on anything a person typed, unless it was rendered by an allow-list renderer.
- [ ] Links and redirects built from stored values only allow `https:`/`http:` (and
      relative paths that can't start with `//` or `/\`).
- [ ] Anything that fetches a URL goes through the webhook sender's `publicOnlyLookup`
      (or the same check), follows no redirects, and has a timeout and a size limit.
- [ ] Expensive endpoints (hashing, image work, exports, sending email) have a rate limit.
- [ ] Secrets (tokens, keys, passwords) are compared with `timingSafeEqual`, stored hashed
      when they only need checking, and never logged or returned after creation.
- [ ] Unexpected errors are left to the error handler, which hides their message; named
      `HttpError`s carry only what the person may see.
- [ ] Admin text goes through `t()`; error messages don't echo raw input as HTML.

## Accounts (2FA, invites, password reset)

- [ ] Reset and invite tokens: random, at least 128 bits, stored hashed, single use,
      expiring within an hour (reset) or a few days (invite).
- [ ] Reset and invite responses don't reveal whether an email has an account.
- [ ] Rate limits per address and per email on reset, invite acceptance and 2FA codes.
- [ ] A password reset or 2FA change ends every other session (`endAllSessionsForUser`).
- [ ] TOTP: codes checked in constant time, each code accepted once, a small clock window;
      recovery codes stored hashed and used once.
- [ ] Sign-in with 2FA doesn't start a full session until the second factor is checked.
- [ ] Emails link to the admin's own origin only, never one taken from the request.
- [ ] Changing an email or password asks for the current password.

## Workflows (review, approval, roles per collection)

- [ ] The server enforces every step (who may approve, who may publish); the admin only
      hides buttons.
- [ ] Per-collection permissions are checked on every entry route, including revisions,
      translations, duplication, preview and search results.
- [ ] Approving your own change is refused when the workflow says so.
- [ ] Scheduled publishing re-checks that the scheduler may still publish.

## Forms (public submissions)

- [ ] Submission endpoints are public by design: listed in `PUBLIC_ROUTES`, rate limited per
      address, with a body limit and a spam check (honeypot or challenge).
- [ ] They accept requests from allowed site origins only when meant to; the CSRF guard
      treats them as public, so add their path deliberately.
- [ ] Submitted values are stored as data and shown in the admin as text, never HTML.
- [ ] CSV exports escape cells that start with `=`, `+`, `-`, `@` (formula injection).
- [ ] File uploads go through the media checks (type by bytes, SVG refusal, size limits).
- [ ] Notification emails can't be made to go to an address taken from the submission.

## Commerce

- [ ] Prices, totals, discounts and stock are worked out on the server from stored data;
      amounts sent by the browser are ignored.
- [ ] Payment provider webhooks are verified by signature, in constant time, with a
      timestamp window, and are idempotent (the same event twice changes nothing).
- [ ] Orders and customers are looked up with the signed-in customer (no reading another
      customer's order by id).
- [ ] Card data never touches Lintel: hosted checkout or provider elements only.
- [ ] Refunds and order edits need their own permissions and are logged.
- [ ] Checkout endpoints are rate limited; coupon codes can't be guessed quickly.

## Plugins

- [ ] Plugins live in the repository and are reviewed like core code; nothing loads code
      from the database or the internet at run time.
- [ ] A plugin's routes respect `enabledPlugins` (answer 404 when off) and pass the route
      access test.
- [ ] A plugin's settings that hold secrets are never returned to the admin in full.
- [ ] Before third-party plugins: a decision record on sandboxing, the permissions a plugin
      asks for, and how an admin sees them before switching one on.

## Builder code blocks (custom HTML, CSS and scripts)

- [ ] Code blocks need their own permission, separate from editing content.
- [ ] Their output is shown in the admin only inside a sandboxed iframe on another origin
      (or `srcdoc` with `sandbox` and no `allow-same-origin`), never in the admin's page.
- [ ] The admin's Content-Security-Policy (`packages/admin/src/security`) is not loosened
      for them (no `unsafe-eval`, no inline scripts).
- [ ] The delivery API marks code-block output clearly, so sites choose to print it.

## Site rendering (Lintel serving pages itself)

- [ ] Rendered pages escape every value by default; raw HTML only from rich text,
      markdown and code blocks rendered as above.
- [ ] Pages are served from a different origin than the admin and the API, or with a CSP
      that keeps them from reaching either with an editor's cookie.
- [ ] Security headers on pages: CSP, `nosniff`, `Referrer-Policy`, HSTS on HTTPS.
- [ ] Preview rendering never caches a draft for the next visitor (`no-store`).
- [ ] Redirects use the SEO redirect rules, which can't point at another site by accident.
- [ ] Template errors show a plain page, not a stack trace.
