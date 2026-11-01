# OpenAPI

`GET /openapi.json` (public) describes the REST API as OpenAPI 3.1. The admin's
Settings → API access → API reference page reads it, and tools such as Postman or code
generators can import it.

Every endpoint is listed in `openapi-operations.ts`, with the same Zod schemas its route
checks requests with; `z.toJSONSchema` turns them into JSON Schema, which OpenAPI 3.1 uses
as it is. `openapi.test.ts` fails if a route under `/delivery`, `/entries`,
`/collections/:handle/entries`, `/media`, `/graphql`, `/sitemap.xml` or `/robots.txt` isn't
listed, or if a listed one doesn't exist. Admin-only endpoints (settings, users, webhooks,
tokens) are left out on purpose.

Each operation says who may call it: `security` lists the API token and session, and
`x-permission` names the permission needed.

| File                    | What it does                              |
| ----------------------- | ----------------------------------------- |
| `openapi-operations.ts` | The list of documented endpoints          |
| `openapi-document.ts`   | Turning the list into an OpenAPI document |
| `openapi.routes.ts`     | `GET /openapi.json`                       |
