# Global settings

Site-wide fields such as the footer text and social links, under Content. The API side is
in `packages/core/src/globals`.

| Route                             | File                   |
| --------------------------------- | ---------------------- |
| `/content/globals`                | `GlobalsPage.tsx`      |
| `/content/globals/:handle`        | `GlobalSetPage.tsx`    |
| `/content/globals/:handle/fields` | `GlobalFieldsPage.tsx` |

- A set's page is a form of its fields (the same `FieldEditor`s as entries) with Save.
  Saving puts the values live; there are no drafts. Leaving with unsaved changes asks first.
- On sites with more than one language, a language picker sits by the title. A language
  with nothing saved shows the main language's values with a note saying so; saving it
  keeps them as its own.
- "Edit fields" (for people who may change content types) opens `GlobalFieldsEditor.tsx`,
  built from the content type builder's pieces (`src/content-types`): the same field list,
  "Add field" sheet and field settings, without a title field. Deleting the set is there too.
- A new set goes straight to its fields, since it has none yet.
