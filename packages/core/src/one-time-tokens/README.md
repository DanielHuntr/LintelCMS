# One-time tokens

Short-lived secrets that work once: password reset links (30 minutes), email change links
(24 hours), the step between a correct password and a two-factor code (10 minutes), and
passkey challenges (5 minutes).

- `issueOneTimeToken` makes a random 256-bit token and stores only its SHA-256 hash.
- `spendOneTimeToken` marks it used and returns it in one statement, so two requests with
  the same link can't both succeed. Expired and used tokens are refused the same way.
- `findUsableOneTimeToken` checks a token without spending it (to show a reset screen).

The features that use them own their own rules (lifetimes, what happens after); this folder
only stores and checks. There are no routes.

| File                            | What it does                   |
| ------------------------------- | ------------------------------ |
| `one-time-tokens.table.ts`      | The `one_time_tokens` table    |
| `one-time-tokens.service.ts`    | Issue, check, spend and cancel |
| `one-time-tokens.repository.ts` | Database reads and writes      |
