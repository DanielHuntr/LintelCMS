# Interface language (admin)

Settings → Interface language: the language of the admin's own words, for you and (with
`settings:update`) the site's default. Not the language of the content; that's
`src/locales`.

| File                            | What it does                                                                |
| ------------------------------- | --------------------------------------------------------------------------- |
| `interfaceLanguage.api.ts`      | Calls to `/interface-language`                                              |
| `loadInterfaceLanguage.ts`      | Asks the server which language to speak; run at start, sign-in and sign-out |
| `interfaceLanguage.queries.ts`  | Saving a choice, then switching the admin to it                             |
| `InterfaceLanguageProvider.tsx` | Draws the admin again when the language changes                             |
| `InterfaceLanguagePage.tsx`     | The settings screen                                                         |

The languages themselves, the messages and the pseudo-languages are in `src/i18n`.
