---
title: Translating Lintel
description: How the admin's words are organised, and how to add a language.
since: "0.1"
---

The admin is written in English, and every other language is a translation of it. This
page is for people adding a translation or adding screens to the admin. To choose a
language, see [Interface languages](/using/interface-languages/).

## Where the words are

Every word the admin shows is a message in `packages/admin/src/i18n/strings.ts` (and the
lists it spreads in, such as `contentModelStrings.ts`). Components never hard-code text;
they call `t("key")`. Messages use ICU MessageFormat, which translation tools such as
Crowdin, Weblate and Lokalise understand:

```ts
"media.count": "{count, plural, one {# file} other {# files}}",
"signIn.title": "Sign in to {product}",
```

- Plurals go in the message, not in separate keys, so a language with more forms (Polish
  has four) can have them all: `t("media.count", { count })`.
- `{product}` is the admin's name: "Lintel", or the agency's when it's
  [branded](/building/branding/). Use it instead of writing "Lintel".
- Numbers and dates are formatted for the reader's language: put `{total, number}` or
  `{when, date, medium}` in a message, or use `formatNumber` and `formatDateTime` from
  `src/i18n/formatting.ts`. Don't call `toLocaleString()` without a locale.
- An apostrophe before `{` makes it literal, as in ICU. Typographic apostrophes (’) are
  plain text.

## Adding a language

1. Copy the English keys you're translating into
   `packages/admin/src/i18n/catalogues/<code>.json`, such as `fr.json`, as
   `"key": "message"` pairs. Keys you leave out are shown in English.
2. Add the language to the list in `packages/admin/src/i18n/interfaceLanguages.ts`, with
   its name in itself ("Français") and its direction (`"rtl"` for Arabic, Hebrew, Persian).
3. Run `pnpm --filter @lintel/admin strings:check`. It reports keys still to translate
   (`--verbose` lists them), keys the translation has that English no longer does, and
   messages whose `{placeholders}` don't match the English.

Please translate by hand, or review machine translation carefully before sending it: a
wrong word on a "Delete" button is worse than an English one.

## Testing with pseudo-languages

In development (or a build made with `VITE_PSEUDO_LANGUAGES=true`), Settings → Interface
language offers two disguised versions of English:

- **Accented English** accents every letter, makes text about a third longer and brackets
  each message: `[Šîĝñ îñ ţö Ļîñţéļ·····]`. Plain text means it was hard-coded; a missing
  bracket means it was cut off or glued together from pieces; overflow shows where longer
  languages won't fit.
- **Right-to-left English** mirrors the words and the whole page, as Arabic would. Anything
  still sitting on the wrong side needs logical CSS: `ms-*`/`me-*` rather than
  `ml-*`/`mr-*`, `ps-*`/`pe-*`, `inset-s-*`/`inset-e-*`, `text-start`. Anything that slides
  sideways needs an `rtl:` version too, as the Toggle's knob has.

## Codemods

`packages/admin/scripts/codemods` holds the scripts that moved the admin to this setup.
They are safe to run again, and do nothing to code that's already converted, so run them
after merging a branch that still uses the old shapes:

```bash
pnpm --filter @lintel/admin codemods
pnpm format
```

They turn `.one`/`.other` key pairs and `tCount()` into plural messages and `t()`, replace
"Lintel" in English strings with `{product}`, and swap left/right Tailwind classes for
logical ones.
