# 18. Field layout, conditions and fieldsets

Date: 2026-11-01

## Context

Content types needed what editors expect from Statamic's blueprints: fields side by side
(widths), tabs and section headings, fields that only appear when another field has a
certain value, rules beyond "required", and sets of fields reused across content types.
Blueprints were a flat list of fields, stored as JSON, compared as canonical JSON by the
content model sync, and written to files.

## Decision

- **Keep the flat list.** Tabs, section headings and spacers are fields of their own
  (`tab`, `section`, `spacer`) that hold no value. A Tab field starts a new tab; everything
  after it is on that tab. Nesting tabs > sections > fields as Statamic does would have
  changed the stored shape, the API, the sync and every reader of `fields`, for the same
  result on screen.
- **Settings beside `options`, left out at their defaults.** `width`, `placeholder`,
  `default`, `helpTextPosition`, `readOnly`, `hidden`, `showInList`, `validation` and
  `conditions` are optional keys on a field. Leaving defaults out means existing blueprints,
  database rows and content model files compare equal without a migration.
- **One condition evaluator, shared.** `@lintel/field-conditions` holds the stored format
  (with Zod) and `isFieldVisible`. The admin hides fields with it as people type; the server
  runs it again when saving, skipping hidden fields and clearing their values unless the
  field keeps them. A rule names a field beside it, `$parent.` one level out, or `$root.` the
  entry's own fields, so conditions work inside groups, repeater rows and blocks.
- **Fieldsets as copies.** A Fieldset field stores a copy of its fieldset's fields, refreshed
  when either is saved. Everything that reads fields then treats it as a group, rather than
  every reader learning to look fieldsets up. Values sit under the Fieldset field's handle,
  so two fieldsets can't collide.

## Consequences

- Readers that walk inner fields go through `innerValueSets` (delivery) and `everyField`
  (sync), which know blocks, groups, repeaters and fieldsets.
- A fieldset can't contain a fieldset, and can't be deleted while in use.
- Conditions are checked against the fields that exist when a blueprint is saved or a file is
  read, so a renamed field can't silently hide another for ever.
