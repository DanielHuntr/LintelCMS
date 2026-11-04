# Newsletter sign-up

A Lintel add-on: people join your Mailchimp or Brevo mailing list from a form on your
website.

- **A sign-up element** for the builder (Insert → Newsletter → Newsletter sign-up): a
  heading, an optional line of text, an email box, a consent tick box and a button.
- **A Liquid tag** for templates: `{% newsletter_signup heading: "Stay in touch", button: "Join", consent: "…" %}`.
- **Your own forms** can sign people up too. Everyone who sends the form with the handle
  `newsletter` (the one the builder's own Newsletter element usually uses) is added; on any
  other form, give it a tick box with the handle `newsletter`, and anyone who ticks it is
  added with the email address they gave. Forms keep their answers in Lintel as usual.
- **Double opt-in** is on by default: Mailchimp sends its confirmation email; Brevo sends
  the double opt-in template you choose and takes people to your page after they confirm.

## Privacy

- Every call to Mailchimp or Brevo is made by your server. Visitors' browsers load nothing
  from either, so the add-on sets no cookies and the cookie notice has nothing to ask.
- The API key stays on the server, in the add-on's own table (`newsletter_connection`),
  not in its settings: the admin only ever sees its last four characters.
- Nobody is added from this add-on's own form without ticking the consent box, and it
  stores nothing in Lintel about the people who sign up.
- With double opt-in off, the form with the handle `newsletter` must have a required consent
  box too. If it has a consent box, that box becomes required; if not, one is added while the
  form is drawn and checked. Nobody is added without a tick, and the saved form isn't changed.
  With double opt-in on, people confirm by email, so the form stays as you made it.
- A hidden field catches robots: they are thanked and nothing is sent.

## Setting it up

1. Install it: `lintel addons add @lintel/addon-newsletter` (or the package's folder or
   `.tgz`), then restart Lintel. It shows in Build → Add-ons, switched on.
2. Open Settings → Newsletter. Choose Mailchimp or Brevo and paste an API key:
   - Mailchimp: Profile → Extras → API keys. The key ends with a code such as `-us21`.
   - Brevo: your name → SMTP & API → API keys.
3. Choose the list people join, decide on double opt-in, and save. Lintel tries the key
   first, so a typo shows straight away.
4. Add the Newsletter sign-up element to a page.

The form posts to `/_lintel/api/addons/newsletter/subscribe` on the website's own address,
so it needs the built-in website (or a proxy that passes `/_lintel/api/` to it). It works
without JavaScript; with it, the answer appears under the button without leaving the page.

## Endpoints

Lintel answers 404 `PLUGIN_NOT_ENABLED` to all of these while the add-on is off.

| Method and path                               | Permission        | Body                                                                                     | Success                         |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| `GET /newsletter/connection`                  | `settings:read`   | none                                                                                     | 200 `ConnectionSummary`         |
| `PUT /newsletter/connection`                  | `settings:update` | `{ provider, apiKey?, listId, doubleOptIn, brevoTemplateId?, brevoConfirmUrl? }`         | 200 `ConnectionSummary`         |
| `DELETE /newsletter/connection`               | `settings:update` | none                                                                                     | 204                             |
| `POST /newsletter/lists`                      | `settings:update` | `{ provider, apiKey? }` (the saved key when left out)                                    | 200 `{ lists: [{ id, name }] }` |
| `POST /delivery/add-ons/newsletter/subscribe` | public            | `{ email, name?, consent, website }`, JSON or a plain form post; 10 a minute per address | 200 `{ message }`               |

`ConnectionSummary` is `{ connected: false }` or `{ connected: true, provider, keyHint, listId, listName, doubleOptIn, brevoTemplateId, brevoConfirmUrl }`.
A plain form post from a browser gets a short page with the message and a link back.
Errors carry a message written for the person who sees it: `NEWSLETTER_KEY_REJECTED`,
`NEWSLETTER_LIST_NOT_FOUND`, `NEWSLETTER_NOT_CONNECTED` (503), `NEWSLETTER_SIGN_UP_NOT_VALID`,
`NEWSLETTER_SIGN_UP_REFUSED`, `NEWSLETTER_PROVIDER_UNREACHABLE` (502), `TOO_MANY_SIGN_UPS` (429).

## Developing

```bash
pnpm --filter @lintel/addon-newsletter build        # dist/server.js and dist/admin.js
pnpm --filter @lintel/addon-newsletter test         # on a real Lintel, services stood in
pnpm --filter @lintel/addon-newsletter db:generate --name <what_changed>
```

## Files

| File                                  | What it does                                             |
| ------------------------------------- | -------------------------------------------------------- |
| `src/server/index.ts`                 | The server half: `definePlugin` (element, tag, event)    |
| `src/server/newsletter.routes.ts`     | The endpoints                                            |
| `src/server/newsletter.service.ts`    | Connecting a service, checking and signing people up     |
| `src/server/newsletter-providers.ts`  | Mailchimp's and Brevo's APIs                             |
| `src/server/newsletter.repository.ts` | Database reads and writes                                |
| `src/server/newsletter.table.ts`      | The `newsletter_connection` table                        |
| `src/server/newsletter.schema.ts`     | Zod schemas and types                                    |
| `src/server/newsletter.errors.ts`     | Named errors with the messages people see                |
| `src/server/signup-form.ts`           | The form visitors see, its script and the no-script page |
| `src/server/newsletter.test.ts`       | Tests                                                    |
| `migrations/`                         | The add-on's migrations, applied by Lintel at start      |
| `src/admin/index.tsx`                 | The admin half: Settings → Newsletter                    |
| `src/admin/NewsletterPage.tsx`        | The Newsletter screen                                    |
| `src/admin/newsletter.api.ts`         | Calls to the add-on's endpoints                          |
| `src/admin/strings.ts`                | Its words                                                |

## Databases

It runs on the built-in database, Postgres, MySQL and MariaDB. After changing a table, run
`pnpm db:generate --name <what_changed>` and then `pnpm db:generate:mysql --name <what_changed>`.
Its queries get their tables through `tableFor`, and `lintel addons check` reads them for
anything only Postgres has. `pnpm test:addons` in `packages/core` runs its tests on real servers.
