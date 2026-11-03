# Liquid editor support

Help for developers writing Liquid templates (see `src/liquid-templates`) in VS Code: a
starting folder, and snippets for Lintel's tags and filters and for the site's own fields.
Docs: "Editor support" in `packages/docs/src/content/docs/building/liquid-templates.md`.

```bash
pnpm lintel templates init   # the templates folder with a working example, and the snippets
pnpm lintel templates sync   # the snippets again, after content types changed
```

## What is written

```text
site/templates/pages.liquid            the example (never replacing a file that's there)
site/layouts/main.liquid
site/partials/card.liquid
.vscode/lintel-liquid.code-snippets    Lintel's tags and filters
.vscode/lintel-fields.code-snippets    entry.data.<field> for each content type's fields
```

Snippets are scoped to `liquid` (the Liquid extension's language) and `html`. Lintel owns
the entries named `Lintel: ...`: they are replaced each time and removed when they are no
longer made. Every other entry in the files is the developer's and is kept as it is. A file
that can't be read (not JSON with comments) is never overwritten.

The fields come from the content model files when there are some (so `sync` works while
`pnpm dev` holds the built-in database), else from the database.

## In development

`main.ts` gives the Liquid templates the `.vscode` folder (`editorSnippetsFolder`). Then,
while the templates folder exists, `field-snippets-sync.ts` writes the snippets when the
server is ready, after admin requests that may change the content model (the rule content
model sync uses, `mayChangeContentModel`), and after content model files were applied
(`model-changed`). Writes are debounced and never overlap. Tests and production never pass
the folder, so nothing is written there.

## Files

| File                          | What it does                                                           |
| ----------------------------- | ---------------------------------------------------------------------- |
| `liquid-editor-commands.ts`   | What `lintel templates` does, as `@lintel/core/liquid-editor-commands` |
| `starter-templates.ts`        | The example files, and writing them without replacing any              |
| `tag-snippets.ts`             | The snippets for Lintel's tags and filters                             |
| `field-snippets.ts`           | The snippets for each content type's fields                            |
| `snippets-file.repository.ts` | Reading, merging and writing a `.code-snippets` file                   |
| `field-snippets-sync.ts`      | Keeping the field snippets up to date in development                   |

## Not included

Hover help and checks as you type would need a Liquid language server that knows Lintel's
tags and the content model. There isn't one; template errors show on the page in
development instead.
