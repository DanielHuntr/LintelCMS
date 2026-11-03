# Page drafts

The shape of a drafted page and how it becomes sections. Page drafting (an optional plugin,
see `packages/core/src/page-drafts`) asks a writing model on the server for a plan; this
folder is the part every package shares.

- `draft-plan.ts`: the kinds of section a draft may have and the words each needs, in one
  table (`draftSectionFields`). From it come the Zod schema the server checks answers with
  (`readDraftPlan`), the JSON schema the model writes under (`draftPlanJsonSchema`, in the
  subset llama.cpp's grammar understands) and the `DraftSection` type. Also the schemas for
  "Rewrite this".
- `draft-plan-sections.ts`: `sectionsFromDraftPlan` turns a plan into sections made by the
  section library's own builders (`src/sections`), so they are ordinary sections in the
  site's theme. Buttons link to `#` until someone chooses a page; pictures are the
  library's illustrations; example quotes are signed "Customer name".
- `draft-plan.test.ts`: the schemas, and every kind of section making a valid page.
