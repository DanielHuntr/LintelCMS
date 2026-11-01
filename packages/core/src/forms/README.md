# Forms

The Forms plugin: forms people fill in on the website (contact, newsletter, quote request,
event booking...), the inbox of what they send, emails about it, and spam protection.
Everything is registered from `server.ts` in one line (`formsFeature`), and every address
answers 404 `FORMS_SWITCHED_OFF` while the plugin is off. Switching it off deletes nothing.

## How a submission flows

1. A website fetches `GET /delivery/forms/:handle` (`public-forms.service.ts`): the fields,
   the steps, and a signed "opened at" token (`spam-protection.ts`).
2. It posts the answers to `POST /delivery/forms/:handle/submissions`, as JSON, multipart or
   a plain HTML form post (`submission-request.ts`). The route is rate limited per address.
3. `receiveSubmission` runs the spam checks first: the honeypot (`_website`), the token
   (too fast means a bot; missing, altered or a day old means "reload the page"), then
   Cloudflare Turnstile when both keys are set.
4. Every answer is checked against its field (`submission-values.ts`), files against their
   field's limits (`submission-files.ts`). Problems come back as `InvalidFieldsError`, one
   message per field handle.
5. Files go into the media library (uploaded by nobody: `uploadedBy` is null), then the
   submission is saved with the first email answer as `submitterEmail`.
6. `announceFormSubmitted` (`form-submitted.ts`) sends the emails (`form-notifications.ts`,
   through `src/email`) and queues the `form.submitted` webhook, with a one-line `text` that
   Slack shows. Failures there are logged; the visitor's submission is already safe.

Bots caught by the honeypot or the timer get the same 201 as everyone else, and nothing is
stored or sent.

## Fields

The list is `formFieldTypes` in `form-fields.schema.ts`, each with its own options schema:
`shortText`, `longText`, `email`, `phone`, `number`, `choice`, `checkboxes`, `dropdown`,
`date`, `file`, `consent`, `hidden` and `step`. A `step` asks nothing: it starts the next
step of a multi-step form, and its label is the step's title. Answers are stored keyed by
the field's handle; answers to fields removed later are kept and exported under the old
handle.

Templates (`form-templates.ts`) are ordinary field lists a new form starts with.

## Pages

`form-fieldtype.ts` adds the `form` fieldtype (it stores a form's handle) to the fieldtype
registry, and `form-block.ts` adds a **Form** block type to the pages blueprint's
`sections` when the plugin is switched on (from `contentForPlugins` in
`src/plugins/plugins.service.ts`). The delivery API serves the block's `form` as the handle;
websites draw it with the embed script or from `/delivery/forms/:handle`.

## The embed script

`forms-embed-script.ts` is the plain browser script served at `/delivery/forms.js`. It is a
string, so it is served as it is with no build step; `public-forms.test.ts` checks it parses.

## Privacy

- **Retention:** a form's `retentionDays` deletes older submissions and their files, every
  hour (`deleteExpiredSubmissions`, started in `forms.feature.ts`).
- **One person's data:** `POST /forms/privacy/export` and `/forms/privacy/erase` find
  submissions by `submitterEmail` across every form.
- Files are deleted with their submission, unless another submission holds the same file or
  an editor has since used it on a page.
- Files in the media library are public by their (random) address, like every asset.

## Endpoints

Admin endpoints need `forms:read`, `forms:update` or `forms:delete`; the Turnstile keys
need `settings:update`.

| Method and path                                   | Permission        | Success                                                     |
| ------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `GET /forms`                                      | `forms:read`      | 200 `{ forms: [Form] }`                                     |
| `POST /forms`                                     | `forms:update`    | 201 `Form`; `{ name, handle?, template? }`                  |
| `GET /forms/:id`                                  | `forms:read`      | 200 `Form`                                                  |
| `PATCH /forms/:id`                                | `forms:update`    | 200 `Form`                                                  |
| `DELETE /forms/:id`                               | `forms:delete`    | 204                                                         |
| `GET /forms/:id/submissions`                      | `forms:read`      | 200 `{ submissions, total }`; `?search&filter&page&perPage` |
| `GET /forms/:id/export`                           | `forms:read`      | 200 `text/csv`                                              |
| `GET /forms/:id/submissions/:submissionId`        | `forms:read`      | 200 with `notes`                                            |
| `PATCH /forms/:id/submissions/:submissionId`      | `forms:update`    | 200; `{ isRead?, isStarred? }`                              |
| `DELETE /forms/:id/submissions/:submissionId`     | `forms:delete`    | 204                                                         |
| `POST /forms/:id/submissions/:submissionId/notes` | `forms:update`    | 201; `{ body }`                                             |
| `DELETE …/notes/:noteId`                          | `forms:update`    | 200                                                         |
| `GET /forms/settings`                             | `forms:read`      | 200 `{ turnstileSiteKey, hasTurnstileSecret }`              |
| `PUT /forms/settings`                             | `settings:update` | 200, the same                                               |
| `POST /forms/privacy/export`                      | `forms:read`      | 200 everything for `{ email }`                              |
| `POST /forms/privacy/erase`                       | `forms:delete`    | 200 `{ deleted }`                                           |
| `GET /delivery/forms/:handle`                     | public            | 200 the form to draw                                        |
| `POST /delivery/forms/:handle/submissions`        | public            | 201 `{ received, confirmation }`                            |
| `GET /delivery/forms.js`                          | public            | the embed script                                            |

The CSV starts with a byte order mark (so Excel reads accents) and defuses answers starting
with `=`, `+`, `-` or `@`, so a submission can't become a spreadsheet formula.

## Files

| File                                          | What it does                                              |
| --------------------------------------------- | --------------------------------------------------------- |
| `forms.feature.ts`                            | Registers everything; the plugin guard; the retention job |
| `forms.table.ts`                              | `forms`, `form_submissions`, `form_submission_notes`      |
| `form-fields.schema.ts`                       | The field types and their options                         |
| `forms.schema.ts`, `submissions.schema.ts`    | Requests and responses                                    |
| `forms-settings.*.ts`                         | The Turnstile keys                                        |
| `form-templates.ts`                           | The ready-made forms                                      |
| `forms.routes.ts`, `submissions.routes.ts`    | Admin endpoints                                           |
| `public-forms.routes.ts`                      | The public endpoints, and the plain-HTML answers          |
| `forms.service.ts`, `submissions.service.ts`  | The builder's and the inbox's rules                       |
| `public-forms.service.ts`                     | Describing a form, receiving a submission                 |
| `submission-values.ts`, `submission-files.ts` | Checking answers and files                                |
| `submission-request.ts`                       | Reading JSON, multipart and URL-encoded bodies            |
| `spam-protection.ts`                          | Honeypot, timing tokens, Turnstile                        |
| `form-notifications.ts`, `form-submitted.ts`  | Emails and the webhook                                    |
| `submissions-csv.ts`                          | The export                                                |
| `form-fieldtype.ts`, `form-block.ts`          | The Form section on pages                                 |
| `forms-embed-script.ts`, `plain-page.ts`      | What browsers are sent                                    |
| `*.repository.ts`                             | Database reads and writes                                 |
