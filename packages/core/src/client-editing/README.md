# Client editing (content only)

Agencies design a site in the builder, then give their clients the **Client (content
only)** role. Clients change the words, pictures and links the designer opened up, and
edit entries as usual, but never the design. See
docs/decisions/0053-content-only-editing-for-clients.md.

## Who is a client

Anyone without `builder:design` ("Design pages"). Owners, Admins, Editors and Authors have
it; the Client role doesn't. Custom roles that could edit content were given it by
migration 0031, so nothing changed for them.

## What the server enforces

- **Page designs** (`checkContentOnlyChange`, called from `validateForCollection` whenever
  a person creates or saves an entry): each page field is compared with the stored one by
  `findDesignChanges` from `@lintel/builder-model` (see its `client-editing/`). Anything
  besides allowed words, pictures and links, and allowed item copies and removals, is
  refused with 403 `DESIGN_CHANGE_NOT_ALLOWED` and a plain message naming the element. The
  page's template can't change either.
- **Shared navigation and footer, site styles and blocks** already need `builder:blocks`,
  which clients don't have.
- **Publishing**: while the site setting `clientChanges` is `needsApproval`, the
  `entry.publishing` check refuses publishing and scheduling by a client (403
  `REVIEW_NEEDED`), and taking a page off the site is refused the same way. They send
  their changes for review instead.

## Reviews

A review (`client_reviews`) points at an entry; the changes are the entry's saved values.
Approving publishes them, as Publish would (required fields are checked). Sending back
needs a note and changes nothing on the site. One review waits per entry at a time.

## Endpoints

| Method and path                      | Permission                          | Body / success                                     |
| ------------------------------------ | ----------------------------------- | -------------------------------------------------- |
| `GET /client-editing/settings`       | `entries:read`                      | 200 `{ clientChanges }`                            |
| `PATCH /client-editing/settings`     | `settings:update`                   | `{ clientChanges: "goLive" \| "needsApproval" }`   |
| `GET /entries/:id/review`            | `entries:read`                      | 200 `{ needsApproval, mustSendForReview, review }` |
| `POST /entries/:id/review`           | editing this entry                  | `{ note? }` → 201, as above; 409 if waiting        |
| `GET /client-reviews`                | `entries:read`                      | `?status=waiting` → 200 `{ reviews }`              |
| `POST /client-reviews/:id/approve`   | `entries:publish`, `builder:design` | 200 the review                                     |
| `POST /client-reviews/:id/send-back` | `entries:publish`, `builder:design` | `{ note }` → 200 the review                        |

## Files

| File                           | What it does                                            |
| ------------------------------ | ------------------------------------------------------- |
| `client-editing.service.ts`    | Who is a client, the setting, the design check, sending |
| `client-reviews.service.ts`    | Listing, approving and sending back reviews             |
| `client-reviews.repository.ts` | Database reads and writes                               |
| `client-reviews.table.ts`      | The `client_reviews` table                              |
| `client-editing.schema.ts`     | Request and response shapes                             |
| `client-editing.errors.ts`     | Named errors with the messages people see               |
| `client-editing.routes.ts`     | The endpoints                                           |
| `register-client-editing.ts`   | The publishing check                                    |
| `client-editing.test.ts`       | The role, the design check and the approval flow        |
