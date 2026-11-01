# Session

Who is signed in, and the calls that change it.

- `session.api.ts`: `signIn`, `signOut` and `fetchCurrentSession`, calling the API's `/auth` routes.
- The router (`src/router.tsx`) asks for the current session before showing any admin screen.
  If nobody is signed in, it sends them to `/sign-in?redirect=<where they were going>`.
  Before that, a brand new Lintel sends everyone to `/setup` (see `src/setup/README.md`).
- `enabledPlugins` lists the features switched on; the sidebar hides sections whose plugin is off.
- The session cookie is HttpOnly, so the admin can't read it. `/auth/me` is the only way to
  know who is signed in.
- `SessionContext.tsx`: `SessionProvider` shares the session with every admin screen.
  `useSession()` returns it and `useCan("entries:publish")` checks a permission, wildcards
  included. Use `useCan` to hide or disable actions someone isn't allowed to take; the API
  checks again, so this is about clarity, not security.
