# Setup

The first-run experience. After `pnpm dev`, a brand new Lintel has no accounts, so the admin
opens on a welcome screen that sets it up in the browser: no terminal prompts, nothing hidden
while typing.

## The flow

A full-screen wizard in the spirit of setting up a new phone. After the welcome (and the
setup code, from another computer only) come five steps, shown along the top:

```text
Database → Your account → Site name → What you're building → Review → You're all set
```

- **Step indicator** (`StepIndicator.tsx`): a `nav` with an ordered list. Each step is a button
  named "Step 2 of 5: Your account"; the current one has `aria-current="step"`, finished ones
  are ticked, and steps not reached yet are shown but disabled. Any visited step can be opened
  again, backwards or forwards. Back and Continue work as before. On phones only the current
  step keeps its label.
- **Setup code** (`SetupCodeScreen`, `SetupCodeInput`): only when `GET /setup/status` says
  `requiresSetupCode`. Kept in memory only (`setupCode.ts`) and sent as `x-lintel-setup-code`.
- **Database**: built-in (recommended) or the person's own PostgreSQL, as tiles. Picking a tile
  only selects it; Continue moves on. PostgreSQL adds the connection screen to the same step,
  with an optional "Test connection" (`POST /setup/database/test`). Left out entirely when
  `database.chosenBy` is `"environment"` (DATABASE_URL decided).
- **Your account** (`CreateAccountScreen`): name, email (with "Did you mean gmail.com?"),
  password with the strength meter, show/hide and "Suggest a password" (see
  `src/password-strength`), and Confirm password, which says "Passwords match" or "These don't
  match yet" once it's been typed in. Continue explains beside itself why it isn't ready while
  the password is too short or too weak; pressing it checks every field, shows each message and
  focuses the first problem (`accountDetails.ts`).
- **Site name** (`SiteNameScreen`): required, trimmed, at most 80 characters (`siteName.ts`).
- **What you're building** (`SiteTypeScreen`): five tiles. The kind of site decides the features
  (forms and SEO tools for every site, plus its extras: core's `setup/site-presets.ts`); they
  can be changed later in Build → Features.
- **Review** (`ReviewScreen`): every answer, grouped by step, each with Edit. Passwords show as
  dots (the account's can be shown). "I've checked these details" must be ticked before Finish
  setup goes ahead; until then the button says why.
- **Finish setup** sends everything once, to `POST /setup/finish`, which applies it all on the
  server. A problem names its step (`details.step`), and `finishProblems.ts` takes the person
  back to that step with the message on the right field.
- **You're all set**: "You're all set, Daniel", what was set up, and Go to your dashboard.

Nothing is saved on the server before Finish. All answers live in `SetupWizard` (shapes in
`setupAnswers.ts`) and are kept in `sessionStorage` for the tab, so refreshing loses nothing,
except passwords, which stay in memory only: after a reload the account step asks for the
password again with a short note. Screens change through `useWizardScreens` (View Transitions,
a crossfade under reduced motion); `useSetupNavigation` tracks visited and finished steps.

## How the router decides

All decisions are plain functions in `setupRouting.ts`, tested in `setupRouting.test.ts` and,
end to end with the real routes, in `src/router.test.ts`.

1. A gate route around sign-in, setup and the admin asks `GET /setup/status` on every
   navigation (until setup is complete, after which the answer is remembered).
2. While `needsSetup` is true, every address except `/setup` redirects to `/setup`.
3. Once setup has finished, `/setup` sends people to `/sign-in`, or to the dashboard if they
   are signed in.
4. Otherwise the usual rules apply: not signed in means `/sign-in?redirect=...`.

If the status can't be fetched at all, `ServerUnreachablePage` explains that the API may not be
running (`pnpm dev`) and offers "Try again".
