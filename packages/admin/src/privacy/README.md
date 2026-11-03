# Privacy

Settings → Privacy: finding, exporting and erasing one person's data, and the tools around
it. The rules live in the API (`packages/core/src/privacy`); these screens show them.

| Screen                        | File                      | Path                          |
| ----------------------------- | ------------------------- | ----------------------------- |
| Privacy, with Find a person   | `PrivacyPage.tsx`         | `/settings/privacy`           |
| Where personal data is kept   | `PersonalDataMapPage.tsx` | `/settings/privacy/data`      |
| How long data is kept         | `RetentionPage.tsx`       | `/settings/privacy/retention` |
| Privacy policy helper         | `PolicyHelperPage.tsx`    | `/settings/privacy/policy`    |
| Companies you share data with | `ProcessorsPage.tsx`      | `/settings/privacy/companies` |

Everything needs `privacy:manage`, and the row in Settings shows only with it.

- `FindPerson.tsx` looks people up with POST, so an email never appears in an address. Erasing
  always asks first, saying what happens to each kind of data, and warns after a search by
  name, because two people can share one.
- Never say a site "is GDPR compliant". The screens say what the tools do, that the rest
  depends on how the site is run, and that suggested wording is not legal advice.
- `privacyStrings.ts` holds the words, spread into `i18n/strings.ts`. Use `{product}`, never
  the product's own name, because agencies can rename the admin.
