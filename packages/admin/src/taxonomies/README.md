# Taxonomies

Categories, tags and other ways to group content, under Content. The API side is in
`packages/core/src/taxonomies`.

| Route                           | File                 |
| ------------------------------- | -------------------- |
| `/content/taxonomies`           | `TaxonomiesPage.tsx` |
| `/content/taxonomies/:taxonomy` | `TaxonomyPage.tsx`   |

- The list shows each taxonomy with its number of terms; "New taxonomy" asks only for a
  name (the handle is made from it, as for fields) and opens the new taxonomy.
- A taxonomy's page lists its terms. "Add term" and choosing a term open `TermSheet.tsx`:
  name, slug (shown as a placeholder made from the name, so leaving it empty is fine) and
  description. Renaming and deleting the taxonomy are in the "..." menu.
- Deleting asks first, and says what happens: entries lose the term. The API refuses to
  delete a taxonomy a content type still uses, and that message is shown as it is.

Editors mostly meet terms in the entry editor, through the terms field
(`src/fields/TermsFieldEditor.tsx`), which can also add a term on the spot.
