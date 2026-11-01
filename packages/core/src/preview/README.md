# Preview

Live preview: letting a website, or the admin's built-in preview, show an entry's draft
before it is published. See `docs/decisions/0008-signed-preview-tokens.md` for why it works
this way.

## How it flows

1. The editor opens the preview. The admin calls `POST /entries/:id/preview` and gets a
   token that works for that entry for 30 minutes, plus the website's preview address with
   the token filled in (or null when the collection has none).
2. With an address, the admin shows the website in a frame. The site reads the token from
   the address and asks the delivery API for the page with it:
   `GET /delivery/pages/about?preview=<token>` (or the `Lintel-Preview: <token>` header).
3. Without one, the admin calls `GET /preview?token=` and draws the result itself.
4. After every save the admin reloads the frame (or asks again), so the preview follows
   the editing. A fresh token is fetched every 20 minutes while the preview stays open.

A draft is only served for the entry the token names, at its current slug. A token for
another entry falls back to the published page; a bad or expired one is a 401
(`PREVIEW_TOKEN_INVALID`, `PREVIEW_TOKEN_EXPIRED`) whose message tells the editor to open
the preview again. Draft responses are `Cache-Control: private, no-store`.

## Preview addresses

A collection's `previewUrlPattern` is where its website shows drafts, set under
Settings, Content types, Live preview (`PUT /collections/:handle`). It must be an
`http(s)://` address and may use `{url}` (the entry's address on the site), `{slug}`,
`{token}`, `{collection}` and `{id}`. Without `{token}` the token is added as `preview=`.

```text
https://example.com/api/preview?path={url}&token={token}
```

## Endpoints

| Method and path             | Permission       | Success                                     |
| --------------------------- | ---------------- | ------------------------------------------- |
| `POST /entries/:id/preview` | `entries:read`   | 200 `{ token, expiresAt, previewUrl }`      |
| `GET /preview?token=`       | none (the token) | 200 `{ collection, entry: DeliveredEntry }` |

Making a token needs only `entries:read`: anyone who can open the entry can already see its
draft. There is no repository: tokens aren't stored, and the secret is a setting.

## Files

| File                 | What it does                                                  |
| -------------------- | ------------------------------------------------------------- |
| `preview-tokens.ts`  | Signing and checking tokens (pure, takes the secret)          |
| `preview-urls.ts`    | Filling in a collection's preview address                     |
| `preview.service.ts` | Making a token for an entry, reading one, the previewed draft |
| `preview.schema.ts`  | Zod schemas for requests and responses                        |
| `preview.errors.ts`  | The two 401s                                                  |
| `preview.routes.ts`  | The endpoints, and the no-store cache header                  |
