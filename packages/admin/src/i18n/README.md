# Admin text and interface languages

Every word the admin shows is a message here, in English, and goes through `t()`. Other
languages are translations of the English, kept in `catalogues/`.

| File                     | What it does                                                           |
| ------------------------ | ---------------------------------------------------------------------- |
| `strings.ts`             | The English messages, and `t()`                                        |
| `*Strings.ts`            | More English messages, spread into `strings.ts` to keep it readable    |
| `icuMessage.ts`          | Reads and fills in ICU MessageFormat (plurals, select, numbers, dates) |
| `translate.ts`           | Looks a key up in the active language, falls back to English           |
| `interfaceLanguages.ts`  | The one list of languages the admin speaks                             |
| `activeLanguage.ts`      | The current language; switching sets `<html lang dir>`                 |
| `pseudoLocales.ts`       | Accented and right-to-left English, for testing                        |
| `formatting.ts`          | Numbers and dates in the current language, through Intl                |
| `catalogues/<code>.json` | Translations: key → message                                            |

## Writing messages

```ts
"media.count": "{count, plural, one {# file} other {# files}}",   // t("media.count", { count })
"signIn.title": "Sign in to {product}",                             // the admin's (branded) name
"entries.saved": "Saved {when, date, medium}",
```

- Put plurals in the message, never in `.one`/`.other` keys or `count === 1 ? … : …`.
- Write `{product}` rather than "Lintel", so a branded admin says the agency's name.
- Never glue messages together from pieces; word order differs between languages.
- Format numbers and dates with `formatting.ts` (or in the message), not
  `toLocaleString()` with no locale.

## Switching language

The language comes from the server (the person's choice, else the site's; see
`src/interface-language`). `switchInterfaceLanguage()` loads its catalogue, sets
`<html lang>` and `<html dir>`, and `InterfaceLanguageProvider` draws the admin again, so
every `t()` call picks up the new words. Codes the admin has no words for fall back to the
closest it has (`fr-CA` → `fr` → English).

## Tools

- `pnpm --filter @lintel/admin strings:check` reports unused keys and, per translation,
  missing and stale keys and mismatched placeholders (`--verbose` lists missing keys).
- `pnpm --filter @lintel/admin codemods` re-runs the scripts in `scripts/codemods` that
  moved the admin to plural messages, `{product}` and logical CSS classes. They are safe to
  run again; run them after merging a branch written the old way, then `pnpm format`.

Contributor guide: `packages/docs/src/content/docs/building/translating.md`.
