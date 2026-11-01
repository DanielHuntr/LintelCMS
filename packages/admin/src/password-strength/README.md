# Password strength

Choosing a new password: the strength meter, its one tip, and "Suggest a password".

- **The rule is the API's.** `passwordStrength.ts` loads `@lintel/core/password-strength`
  (zxcvbn-ts with its common and English dictionaries) the first time a new-password field
  appears, so the sign-in screen and the first setup screens don't download it. The API runs
  the same check when a password is set, so the meter and the server always agree: at least
  12 characters and "Good" or better. The person's name and email count as easy guesses.
- **The meter** (`PasswordStrengthMeter.tsx`): four segments and a label, "Too weak", "Weak",
  "Good" or "Strong", with at most one short tip. The words always say the level, so colour is
  never the only signal. The visible text is linked to the input with `aria-describedby`; a
  separate polite live region reads the result once typing pauses (`useSettledValue`), not on
  every key. Colour changes are skipped under reduced motion.
- **The suggestion** (`passphrase.ts`): four random words and a two-digit number joined with
  hyphens, like `maple-orbit-cactus-river-42` (about 58 bits). Numbers come from
  `crypto.getRandomValues` with rejection sampling (`randomIndexBelow`), so no word is more
  likely than another. The word list is loaded only when someone asks for a suggestion.
  `NewPasswordField` fills the field, shows it, offers Copy and suggests a password manager.
  `autocomplete="new-password"` stays, so the browser's own generator still offers itself.

| File                        | What it does                                            |
| --------------------------- | ------------------------------------------------------- |
| `NewPasswordField.tsx`      | The field with show/hide, the meter and the suggestion  |
| `PasswordStrengthMeter.tsx` | The four-segment meter, its label, tip and announcement |
| `passwordStrength.ts`       | Loading the checker; the words for levels and tips      |
| `usePasswordStrength.ts`    | The strength of a password as it's typed                |
| `useSettledValue.ts`        | A value once it has stopped changing, for announcements |
| `passphrase.ts`             | The passphrase generator and the fair random index      |
| `eff-large-wordlist.txt`    | The words (see below)                                   |

## Word list licence

`eff-large-wordlist.txt` is the EFF Large Wordlist for Passphrases by the Electronic Frontier
Foundation, licensed under [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/),
from <https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases>. The dice numbers
were removed and the four hyphenated words left out. Details are in `NOTICE` in this folder.
