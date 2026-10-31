# HTTP helpers

Small pieces every feature's routes share.

| File             | What it does                                                             |
| ---------------- | ------------------------------------------------------------------------ |
| `http-errors.ts` | `HttpError` (status + stable code + readable message) and `parseRequest` |

## Error responses

Throw an `HttpError` subclass from a route, preHandler or service and Fastify turns it into:

```json
{ "statusCode": 403, "code": "PERMISSION_DENIED", "error": "Forbidden", "message": "..." }
```

`code` is stable, so the admin can act on it; `message` is written for people.
Feature-specific errors live in their feature folder (for example `src/auth/auth.errors.ts`).
