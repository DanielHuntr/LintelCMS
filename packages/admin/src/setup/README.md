# Setup

The first-run experience. After `pnpm dev`, a brand new Lintel has no accounts, so the admin
opens on a welcome screen that sets it up in the browser: no terminal prompts, nothing hidden
while typing.

## The flow

```text
(setup code)  →  1 Database  →  2 Account  →  3 Your site  →  dashboard ("You're all set")
   /setup          /setup         /setup        /setup/site
```

- **Setup code** (`SetupCodeStep`): only when `GET /setup/status` says `requiresSetupCode`,
  which means someone is setting up from another computer. The code is shown in the terminal
  where Lintel runs. It is kept in memory only (`setupCode.ts`) and sent as the
  `x-lintel-setup-code` header on every setup request. If the API turns it down, the flow
  returns to this step with the API's message. It isn't a numbered step.
- **Database** (`DatabaseStep`, `PostgresFields`): built-in (recommended) or the person's own
  PostgreSQL. Skipped when `database.chosenBy` is `"environment"` (DATABASE_URL decided), and
  the account step then says so. "Test connection" is optional reassurance: Continue checks the
  connection again as it saves. API errors appear on the field they are about
  (`fieldForDatabaseError` in `postgresConnection.ts`).
- **Account** (`AccountStep`): name, email (with a typo check, see `design/EmailField.tsx`) and
  one password field with "Show password" instead of a confirm field. The address is repeated
  in bold by the button. `POST /setup` signs the person in.
- **Your site** (`SiteStep`): "What are you building?". Each kind of site switches on a set of
  plugins (`sitePresets.ts`), shown as toggles that can be changed. "Skip for now" saves a
  blank site with no plugins. It has its own route because the person is signed in by now.

`SetupFlow` moves between the steps at `/setup`; `SetupPage` and `SiteSetupPage` connect the
flow to the router. Each step's errors go through `stepProblemFor` (`setupErrors.ts`): "already
set up" sends people to sign in, a rejected setup code goes back to that step, and everything
else is shown in the step, next to a field where possible.

## How the router decides

All decisions are plain functions in `setupRouting.ts`, tested in `setupRouting.test.ts` and,
end to end with the real routes, in `src/router.test.ts`.

1. A gate route around sign-in, setup and the admin asks `GET /setup/status` on every
   navigation (until setup is complete, after which the answer is remembered).
2. While `needsSetup` is true, every address except `/setup` redirects to `/setup`.
3. Once the account exists, `/setup` sends people to `/sign-in`, or to `/setup/site` or the
   dashboard if they are signed in.
4. Someone signed in whose `siteSetupCompleted` is false is sent from any admin screen to
   `/setup/site`, so closing the tab after creating the account doesn't skip the last step.
5. Otherwise the usual rules apply: not signed in means `/sign-in?redirect=...`.

If the status can't be fetched at all, `ServerUnreachablePage` explains that the API may not be
running (`pnpm dev`) and offers "Try again".
