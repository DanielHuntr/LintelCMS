# Setup

The first-run experience. After `pnpm dev`, a brand new Lintel has no accounts, so the admin
opens on a welcome screen that sets it up in the browser: no terminal prompts, nothing hidden
while typing.

## The flow

A full-screen wizard with one question per screen, in the spirit of setting up a new phone:

```text
/setup        Welcome → (Setup code) → Database → (PostgreSQL) → Name → Email → Password
/setup/site   What are you building? → Choose your features → Done → dashboard
```

- **Welcome**: "Welcome to Lintel" and Get started.
- **Setup code** (`SetupCodeScreen`, `SetupCodeInput`): only when `GET /setup/status` says
  `requiresSetupCode`, meaning someone is setting up from another computer. The terminal shows
  8 digits like `4821-0937`; the input draws two groups of four boxes over one real input, and
  sends the digits alone. The code is kept in memory only (`setupCode.ts`) and sent as the
  `x-lintel-setup-code` header on every setup request. If the API turns it down, the wizard
  returns to this screen with the API's message.
- **Database**: built-in (recommended) or the person's own PostgreSQL, as tiles. Picking a
  tile moves on by itself; the arrow keys only change the choice. Skipped with the next screen
  when `database.chosenBy` is `"environment"` (DATABASE_URL decided). A `409` from the
  database endpoints means the same thing, so the wizard simply moves on.
- **PostgreSQL** (`PostgresScreen`, `PostgresFields`): only if chosen. Test connection is
  optional reassurance: Continue saves with `POST /setup/database`, which tests it again.
  Errors appear on the field they are about (`placeDatabaseProblem`).
- **Name, Email, Password**: one field each. The email screen offers a one-click fix for domain
  typos (`design/EmailField.tsx`); the password screen repeats the email and creates the
  account (`POST /setup`, which signs the person in). An API problem with an earlier answer
  takes the person back to that screen with the message shown there.
- **What are you building?** and **Choose your features** (`SiteWizard`): each kind of site
  switches on a set of plugins (`sitePresets.ts`), shown with the API's own names as toggles.
  Finish setup or Skip for now (a blank site, no plugins) saves with `POST /setup/site`.
- **Done**: "You're all set, Daniel", what was set up, and Go to your dashboard.

`SetupWizard` (the /setup screens) and `SiteWizard` (the /setup/site screens) own all the
answers, so Back never loses anything. Each screen in `screens/` is presentational and built on
`WizardScreen`: one big question, a sentence, the content, and Back and Continue pinned to the
bottom. Every screen is a form, so Enter continues; each screen focuses its field, or its
question when it has none. Screens change through `useWizardScreens`, which uses the View
Transitions API to slide the new screen in (styles.css; a crossfade under reduced motion).

Refreshing mid-way starts that half again from its first screen: the server's state already
decides between /setup and /setup/site.

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
