# Security log

Settings → Security log (`/settings/security-log`), for people with `security:read`: a table
of sign-ins, failures and changes to people and access, filterable by kind and paged, with
**Download CSV** (a plain link to the API's export, so the browser sends the session cookie).

| File                                           | What it does                                     |
| ---------------------------------------------- | ------------------------------------------------ |
| `SecurityLogPage.tsx`                          | The page                                         |
| `describeSecurityEvent.ts`                     | Event names and a one-line summary of each event |
| `securityLog.api.ts`, `securityLog.queries.ts` | API calls and the query hook                     |
