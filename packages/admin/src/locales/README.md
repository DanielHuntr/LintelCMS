# Languages

The site's languages (locales), at `/settings/languages` (`LanguagesPage.tsx`). The API
side is in `packages/core/src/sites`; how translations work is in
`docs/decisions/0007-translations-as-linked-entries.md`.

- The main language is marked "Main" and can be renamed but not removed. Others can be
  removed while nothing is written in them; the API's message says why when it refuses.
- "Add language" (`AddLanguageSheet.tsx`) offers common languages by name
  (`commonLocales.ts`, named with `Intl.DisplayNames`), or "Another language…" to type a code.

Other screens use the languages through:

- `useLocales()` and `useLocaleName()` in `locales.queries.ts`;
- `LocalePicker.tsx`, the language select on the entries list and global settings, which
  hides itself on sites with one language;
- `src/content/TranslationsSection.tsx`, the entry editor's Language panel: which language
  the entry is in, its translations (with their status), and "Translate" to start one.
