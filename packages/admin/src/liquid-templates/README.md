# Liquid templates

The **Template** section of the entry editor's side panel: which template draws a page on
the website. Core's `src/liquid-templates` has the templates themselves; docs are in
`packages/docs/src/content/docs/building/liquid-templates.md`.

- `TemplateChoiceSection.tsx` shows the choice only when `GET /website/liquid-templates`
  lists templates, so installs without a templates folder see nothing new. It is shown for
  collections whose entries have pages.
- The choice is stored in the entry's values under `_template`, like a field: the editor
  sends it with the next save (`fieldChanged`), and it goes live when the page is published.
  "Standard" is no value at all (sent as `null`), "Visual design" is `designed`, and any
  other value is a template's name.
- `liquidTemplateStrings.ts` holds the words, spread into `i18n/strings.ts`.
