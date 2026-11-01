# 7. Live preview uses short-lived signed tokens

Date: 2026-11-01

## Decision

To show a draft on the real website, the admin asks for a preview token
(`POST /entries/:id/preview`). A token names one entry and an expiry half an hour away,
signed with HMAC-SHA256 using a secret kept in settings (`previewSigningSecret`, made the
first time anyone previews). The delivery API serves that entry's working copy instead of
its published copy when the token comes with the request (`?preview=` or the
`Lintel-Preview` header), with `Cache-Control: private, no-store`. Tokens aren't stored.

## Why

The website fetching the draft is usually another server, often on another domain, so it
can't use the editor's session cookie, and it shouldn't need an API key with wider access
just to render one page. A token that only opens one entry, for a short time, is the least
a site needs. Signing instead of storing means no table to fill and clean up, and checking
a token costs one HMAC. The secret lives in the database rather than in an environment
variable, so preview works with no setup on a fresh install, and every server behind a
load balancer shares it.

## Alternatives considered

- **Stored tokens in a table**: revocable one by one, but they need cleaning up, and a
  leaked preview link only shows a draft for half an hour anyway.
- **A delivery API key with draft access**: one secret for the whole site; a leak shows
  every draft, and it has to be set up before preview works.
- **JWTs**: the same idea with a bigger format and a library; our payload is two fields.

Rotating `previewSigningSecret` (deleting the setting) ends every open preview link.
