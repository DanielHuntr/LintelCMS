# Session

Who is signed in, and the calls that change it.

- `session.api.ts`: `signIn`, `signOut` and `fetchCurrentSession`, calling the API's `/auth` routes.
- The router (`src/router.tsx`) asks for the current session before showing any admin screen.
  If nobody is signed in, it sends them to `/sign-in?redirect=<where they were going>`.
- The session cookie is HttpOnly, so the admin can't read it. `/auth/me` is the only way to
  know who is signed in.
