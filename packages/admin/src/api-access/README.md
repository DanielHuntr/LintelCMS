# API access

Build → API access (`/build/api`): how websites, apps and scripts reach the content.

- **Where your content is**: the REST and GraphQL addresses, each with a copy button, and
  a link to the API reference.
- **Who can read published content**: the "Only with a token" switch, and the websites
  allowed to call the API from visitors' browsers (CORS). Both are the
  `/delivery-access` endpoint in core.
- **Tokens**: a list with a guided empty state. "New token" names it and chooses read only
  or read and write, then shows the token once with a copy button and a warning that it
  won't be shown again. Deleting asks first.

People with `settings:read` see everything; changing needs `settings:update`.

The API reference (`/build/api/reference`) reads the server's own `/openapi.json` and
lists every endpoint by area, each opening (a native `<details>`) to show who may call it,
its parameters and its answers. There is a link to download the file for other tools.

| File                                       | What it does                                      |
| ------------------------------------------ | ------------------------------------------------- |
| `ApiAccessPage.tsx`                        | The page                                          |
| `DeliveryAccessSettings.tsx`               | "Only with a token" and the allowed websites      |
| `TokenList.tsx`                            | The tokens, with delete                           |
| `CreateTokenDialog.tsx`                    | Making a token and showing it once                |
| `ApiReferencePage.tsx`                     | The reference page                                |
| `openApiReference.ts`                      | Reading the endpoints out of the OpenAPI document |
| `apiAccess.api.ts`, `apiAccess.queries.ts` | Calls to the API, and their caching               |
