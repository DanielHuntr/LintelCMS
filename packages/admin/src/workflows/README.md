# Automations (admin)

The screens for `packages/core/src/workflows`. Shown while the `automations` plugin is on.

- **/automations**: your automations with a plain-English summary of each, examples to
  start from, and a link to content approval.
- **/automations/new** and **/automations/$workflowId**: the builder. The flow reads top to
  bottom: the trigger card, then a card per step, with a **+** between cards to add a step
  there. Conditions and approvals split into two lanes. **Test run** runs with example
  data; **History** lists runs with what each step did.
- **/automations/approval**: which collections need approval, and who reviews.
- `EntryReviewSection` sits in the entry editor's side panel; `NotificationsButton` is the
  bell beside Help.

`workflowsRoutes.tsx` is the one registration point (spread into `router.tsx`), and
`workflowStrings.ts` holds every word (spread into `src/i18n/strings.ts`).

| File                                                                                                                                    | What it does                                   |
| --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `WorkflowsPage.tsx`, `TemplateGallery.tsx`, `workflowTemplates.ts`                                                                      | The list and the examples                      |
| `WorkflowBuilderPage.tsx`, `WorkflowEditor.tsx`                                                                                         | The builder                                    |
| `StepList.tsx`, `StepCard.tsx`, `stepIcons.ts`                                                                                          | The flow of cards                              |
| `StepEditorDialog.tsx`, `TriggerEditorDialog.tsx`, `ConditionsField.tsx`, `HeadersField.tsx`, `RecipientsField.tsx`, `FormControls.tsx` | Filling steps in                               |
| `describeSteps.ts`                                                                                                                      | Plain-English sentences for triggers and steps |
| `stepTree.ts`                                                                                                                           | Adding, changing, moving and removing steps    |
| `RunHistory.tsx`, `RunStatusBadge.tsx`, `TestRunDialog.tsx`                                                                             | Runs                                           |
| `ContentApprovalPage.tsx`, `EntryReviewSection.tsx`                                                                                     | Content approval                               |
| `NotificationsButton.tsx`                                                                                                               | The bell                                       |
| `workflows.api.ts`, `workflows.queries.ts`, `workflows.types.ts`                                                                        | Talking to the API                             |
