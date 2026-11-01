# Account

`/account`: the signed-in person's own account, opened from their name in the sidebar.

| File                                   | What it does                                                               |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `AccountPage.tsx`                      | The page; puts two-factor first when the role requires it                  |
| `ProfileSection.tsx`                   | Name and picture (from the media library)                                  |
| `EmailSection.tsx`                     | Changing email: a link goes to the new address first                       |
| `PasswordSection.tsx`                  | Changing password, which signs out other devices                           |
| `TwoFactorSection.tsx`                 | On or off, recovery codes left, new codes, turning off                     |
| `TwoFactorSetupDialog.tsx`             | QR code and typed key, the first code, then the recovery codes             |
| `RecoveryCodes.tsx`                    | A set of recovery codes, shown once, with Copy all                         |
| `PasskeysSection.tsx`                  | Adding (through the browser's own prompt) and removing passkeys            |
| `SessionsSection.tsx`                  | Where you're signed in, and "Sign out other devices"                       |
| `ConfirmEmailPage.tsx`                 | `/confirm-email#token=...`, opened from the new address's inbox            |
| `NewPasswordField.tsx`                 | The field for choosing a new password, with the length hint                |
| `PasswordStrengthSlot.tsx`             | Where the password strength meter goes once it lands (renders nothing yet) |
| `account.api.ts`, `account.queries.ts` | API calls and their TanStack Query hooks                                   |

Someone whose role requires two-factor authentication and hasn't turned it on is sent to
this page from every other admin address (see `router.tsx`), with a notice saying why.

`NewPasswordField` is used everywhere a new password is chosen outside setup: here, when
accepting an invitation and when resetting a forgotten password. The strength meter and
"suggest a password" are being built separately; `PasswordStrengthSlot` is the one place to
render them so all of those screens get them at once.
