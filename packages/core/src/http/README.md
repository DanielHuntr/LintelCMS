# HTTP helpers

Small pieces every feature's routes share.

| File                     | What it does                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `http-errors.ts`         | `HttpError`, `InvalidFieldsError`, `parseRequest` and the error handler for details  |
| `handle.schema.ts`       | The rule for handles (`blog_post`, `hero_image`) used by blueprints and fields       |
| `cross-origin.ts`        | CORS: the admin may call everything, listed websites the public content APIs         |
| `cross-site-requests.ts` | Refuses changes sent from pages other than the admin's (forged requests)             |
| `security-headers.ts`    | nosniff, a strict CSP, no framing, no referrer, and HSTS on HTTPS for every response |
| `request-logging.ts`     | What the log records per request, with preview tokens and other secrets hidden       |

## Error responses

Throw an `HttpError` subclass from a route, preHandler or service and Fastify turns it into:

```json
{ "statusCode": 403, "code": "PERMISSION_DENIED", "error": "Forbidden", "message": "..." }
```

`code` is stable, so the admin can act on it; `message` is written for people.
Feature-specific errors live in their feature folder (for example `src/auth/auth.errors.ts`).

## Errors with more to say

Pass `details` as the fourth argument and they are added to the body. Fastify's own
handler would drop them, so `sendHttpErrorDetails` (registered in `server.ts`) sends them;
errors without details go to Fastify's handler as before.

```ts
throw new HttpError(409, "ASSET_IN_USE", "This image is still used.", { usedBy });
```

`InvalidFieldsError` is the common case: a 400 `INVALID_REQUEST` whose `fields` has one
message per field handle, so the admin can show each next to its input.

```json
{
  "statusCode": 400,
  "code": "INVALID_REQUEST",
  "error": "Bad Request",
  "message": "Some fields need attention:\n- title: Title is required",
  "fields": { "title": "Title is required" }
}
```

## Unexpected errors

An error that isn't an `HttpError` and has no 4xx status is a bug or an outage. Its message
can hold internals (SQL, file paths), so it goes to the log and the response says only:

```json
{
  "statusCode": 500,
  "code": "INTERNAL",
  "error": "Internal Server Error",
  "message": "Something went wrong on the server. ..."
}
```
