# Fixtures

`lintel-test.ts` exports the `test` and `expect` every spec uses. On top of Playwright's own
fixtures it adds:

- `lintel`: the running site (`url`, `apiUrl`), chosen with `test.use({ site })`
- `content`: what the seeded site was seeded with, by name
- `api` / `editorApi`: the API as the owner or the editor
- `signedInAs` (option) and `signInAs(role)`: who the browser is signed in as
- `uniqueTitle("...")`: a title no other test will use

Signing in reuses sessions made while seeding, so tests don't spend time on the sign-in form
or run into its rate limit. `tests/journeys/signing-in-and-out.spec.ts` covers the form itself.
