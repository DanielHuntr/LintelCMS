# Client editing (content only)

The admin's side of content-only editing (the server's is `packages/core/src/client-editing`;
the reasoning is in docs/decisions/0053-content-only-editing-for-clients.md).

- **The client's view of a page.** `PageDesignPage` opens the builder with `contentOnly` for
  anyone without `builder:design`: the page as it looks, with only the words, pictures and
  links the designer opened up (see `ContentEditingScreen` in `@lintel/builder`).
- **Send for review.** While Users and roles → "Clients' changes" is "Wait for approval",
  a client's Publish (in the builder and the entry editor) is `SendForReviewButton`, and
  what the reviewer said when sending changes back shows as `SentBackNote`.
- **Waiting for review.** A dashboard widget (`WaitingForReviewWidget`, for people who may
  publish) lists clients' changes, with Approve and Send back (which asks for a note) for
  people who may also design. The collection view's status filter has "Waiting for review".
- **Design-only fields.** The entry editor hides the template choice from clients.

| File                         | What it does                                       |
| ---------------------------- | -------------------------------------------------- |
| `clientEditing.api.ts`       | Calls to the API                                   |
| `clientEditing.queries.ts`   | TanStack Query hooks                               |
| `SendForReview.tsx`          | The Send for review button and the sent-back note  |
| `WaitingForReviewWidget.tsx` | The dashboard widget, with the Send back dialog    |
| `ClientChangesSetting.tsx`   | The "Clients' changes" setting on the Roles screen |
| `clientEditingStrings.ts`    | The words, spread into `i18n/strings.ts`           |
| `clientEditing.test.tsx`     | The button, the note, the widget and the setting   |
