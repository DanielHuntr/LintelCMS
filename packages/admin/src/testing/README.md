# Testing helpers

Shared by the admin's component tests.

- `renderScreen(<Screen />, { permissions })` renders a screen inside a router, a fresh query
  cache and a signed-in session, as the app does.
- `mockApi((request) => body)` replaces `fetch` with a function that answers like the API and
  records every request, so tests can check what was sent. Throw `apiErrorResponse(...)` from
  it to answer with an error in the API's shape.
