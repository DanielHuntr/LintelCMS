# Threat model

Date: 2026-11-01. Covers the API server (`packages/core`), the admin (`packages/admin`) and
the Next.js starter as they are after phase 2. Review it when a feature adds a new kind of
user, a new way in, or code that runs on behalf of someone else (see
[checklist.md](checklist.md)).

## What we protect

| Asset                              | Why it matters                                                               |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Admin sessions                     | A session is the editor: it can publish, delete and change settings          |
| Passwords (scrypt hashes)          | People reuse them; a leak hurts beyond Lintel                                |
| API tokens                         | Read-write tokens can change and publish content without a person            |
| Unpublished content and revisions  | Drafts, scheduled launches and old versions are often confidential           |
| Published content and its delivery | Defacement, or content served to the wrong site, hurts the site owner        |
| Uploaded files                     | Served from the API's address, so a hostile file could act as the API        |
| Webhook and preview secrets        | They prove to receivers and websites that Lintel sent something              |
| The server and its network         | Webhooks and setup make outgoing connections; it can reach private addresses |
| The setup window                   | Until the first admin exists, whoever gets there first owns the install      |

## Who we defend against

- **Anonymous internet visitors**, who can reach the public endpoints and try anything.
- **Other websites an editor visits**, which can make the editor's browser send requests,
  including sites on the same registrable domain (`blog.example.com` next to
  `cms.example.com`).
- **Signed-in people with fewer permissions**, who should get exactly their role's rights.
- **Holders of a leaked token or preview link**, who should get only what that grants.
- **Receivers of webhooks and websites calling the API**, who are not trusted with more
  than they are sent.

Out of scope: someone with shell or database access to the server, and plugin code (see
"Plugins" below), which runs with the server's full rights by design.

## Trust boundaries

```text
 Browser (admin SPA) ──cookie──┐
 Websites / starter ──token?───┤
 Search engines ───────────────┼──▶ API (Fastify) ──▶ database, uploads folder
 Anyone (setup, first run) ────┘          │
                                          └──▶ webhook receivers, Postgres (setup test)
```

1. **Browser admin → API.** Session cookie (`__Host-lintel_session`, httpOnly, Secure,
   SameSite=Lax). Every change must come from the admin's origin (`Origin` check, see
   `src/http/cross-site-requests.ts`). Every route is guarded by a permission or listed as
   public with a reason (`src/auth/route-access.test.ts` enforces it).
2. **Public delivery (`/delivery/*`, `/graphql`).** Published content only. Open by default;
   when Settings → API access requires a token, every delivery route asks for one. CORS
   lets listed websites read without cookies.
3. **Setup.** Open only until the first user exists. From anywhere but this computer
   (judged by the socket address, any forwarding header, and a localhost `Host`) it needs
   the one-time code printed in the terminal.
4. **API tokens.** Bearer tokens, stored as SHA-256 hashes. A token acts for its creator,
   limited to content and media permissions and never more than the creator has now.
5. **Webhooks.** Outgoing POSTs signed with HMAC-SHA256. Private and local addresses are
   refused at save time and again at connect time (DNS answers are checked as the
   connection is made); redirects aren't followed.
6. **Uploads.** Judged by their bytes, not their name. SVGs with active content are refused,
   images over 100 megapixels are refused, and every file is served with a sandboxing CSP,
   `nosniff` and a safe `Content-Disposition`.
7. **Preview links.** HMAC-signed, one entry, 30 minutes. Never cached, hidden in logs.
8. **Plugins.** Plugins in `src/plugins` are part of the codebase and trusted like the rest
   of the server. Switching a plugin on in Settings is the only runtime choice. Third-party
   plugins, if they come, need a separate model (see the checklist).

## STRIDE

| Threat                           | Where                                     | What stops it                                                                                                                              |
| -------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **S**poofing a person            | Sign-in, sessions                         | scrypt, equal-time failures, 10 sign-ins a minute per address, random 256-bit session tokens stored hashed                                 |
| Spoofing via planted cookie      | Sibling subdomains                        | `__Host-` cookie prefix; sign-in ends any session the browser already had                                                                  |
| Spoofing the first admin         | Setup                                     | Setup code for remote requests, localhost `Host` for local ones, one admin at a time under a lock                                          |
| **T**ampering by forged requests | Admin API                                 | SameSite=Lax plus the `Origin` / `Sec-Fetch-Site` check on every change                                                                    |
| Tampering by mass assignment     | PATCH/PUT bodies                          | Every body goes through a Zod schema that drops unknown keys; services choose the columns they write                                       |
| Tampering with previews          | Preview tokens                            | HMAC signature compared in constant time, expiry inside the signed payload                                                                 |
| **R**epudiation                  | Content changes                           | Revisions record who saved what and when; webhook deliveries are logged                                                                    |
| **I**nformation disclosure       | Drafts through delivery                   | Delivery reads the published copy; drafts need a preview token or a read-write token                                                       |
| Disclosure in errors             | 500 responses                             | Unexpected errors answer with a plain sentence; the details go to the server log                                                           |
| Disclosure in logs               | Request log                               | Headers aren't logged; preview tokens and other secrets in query strings are hidden                                                        |
| Disclosure of the schema         | GraphQL introspection                     | Only for requests with a session or token, or in development                                                                               |
| Disclosure by SSRF               | Webhooks                                  | Private-address block list (IPv4, IPv6 and the tunnelled forms), checked at connect time                                                   |
| **D**enial of service            | GraphQL                                   | Depth 10, cost 5000, 5000 tokens, 100 KB bodies, no batching                                                                               |
| DoS by images                    | Uploads and resizing                      | 25 MB uploads, 100 MP images, sharp's pixel limit, 4000 px sizes, 300 new sizes a minute per address, 30 uploads                           |
| DoS on sign-in                   | Rate limits                               | Per-address limits; `TRUST_PROXY` so a proxy doesn't make every visitor one address                                                        |
| **E**levation of privilege       | Any route                                 | `requirePermission` on every route; the route test fails if one is missing                                                                 |
| Elevation through tokens         | API tokens                                | Never settings, users or roles; capped at the creator's current permissions                                                                |
| Elevation through XSS            | Rich text, markdown, SVG, help, filenames | Rich text rendered from the editor schema (unsafe links emptied), markdown-it with `html: false`, React escaping, SVG refusal, strict CSPs |

## The top risks today

1. **Tenant isolation is a convention, not a guarantee.** Every table has `tenant_id`, but
   most queries look rows up by id alone. With one tenant per install that is harmless;
   the cloud version must add the tenant to every query (and a test like the route test
   that proves it) before a second tenant exists.
2. **Plugins and future builder code blocks run as the server or in the admin's origin.**
   A malicious or careless plugin has full access. Keep plugins in-repo and reviewed until
   there is a sandbox and a permission model for them.
3. **Read tokens in browsers.** Websites that put a read token in client-side code publish
   it. Read tokens only see published content, but they can't be scoped per site yet.
4. **The admin's own headers depend on hosting.** The admin is static files; its CSP is
   added to the built HTML, but `frame-ancestors`, HSTS and the rest must be set by
   whatever serves it (see `packages/admin/README.md`).
5. **Live preview frames other sites with scripts and same-origin allowed.** If a preview
   address pointed at the admin's own origin the sandbox would not hold. Only people who
   can change collections can set it.
6. **No audit log for settings, tokens and webhooks.** Revisions cover content only.
