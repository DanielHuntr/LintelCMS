# Fix log: security, data and tooling (`fix/security-review`)

Fixing pass, 2 Nov 2026, on `fix/security-review` from `release/1.0.0-rc` with `qa/batch-2` merged (`f6fa1da`). The defects are described in `BUG-REPORT.md` (batch 2 and batch 3), which this log doesn't change.

**Environment:** Windows 11, Node 22, the built-in database in tests. Each fix was made test-first: the regression test was run against the old code to see it fail, then against the fix.

**Test runs (after the last commit):**

- format check, `pnpm lint` and `pnpm typecheck`: all clean;
- admin: 110 files, 600 tests, all passed;
- builder: 207 unit tests and 10 browser tests; builder-model 150; site-components 35; motion 118; motion-editor 28; docs 11; field-conditions 17: all passed;
- core: 151 files; 959 passed, 23 failed, 5 skipped;
- cli: 27 passed, 3 failed.

None of the remaining failures are caused by these fixes. They are Windows-only, and CI (Linux) doesn't see them:

- `tar` reads `C:\…` as a remote host (release-signature, updates, supervisor tests);
- installs are told apart by POSIX paths (install-type), and the start-up tests (`main`, `dev-runtime`, `model-sync`, the CLI's `command-line` and `model`) spawn processes in ways that assume Linux;
- `plugin-system.test.ts` (the GET /fieldtypes shape), already fixed on `fix/qa-leftovers`.

One CLI test (`loads without failing…`) timed out under the full parallel run and passes on its own.

## Summary

| ID              | Status | Commit    | Change in one line                                                                                |
| --------------- | ------ | --------- | ------------------------------------------------------------------------------------------------- |
| LINTEL-SEC-001  | Fixed  | `70de68d` | Only owners, in a browser, can read the outbox; secret links to anyone else are hidden            |
| LINTEL-SEC-004  | Fixed  | `545b17d` | Resending or cancelling an invitation needs the right to give its role                            |
| LINTEL-SEC-005  | Fixed  | `c5379ca` | Every content tree, recycle bin and SEO route checks the sites the person may work on             |
| LINTEL-SEC-006  | Fixed  | `7a45d4b` | Code CSS can't end the page's `<style>`: escaped when compiled and again when the page is written |
| LINTEL-SEC-007  | Fixed  | `e881f32` | The server cleans code HTML with DOMPurify on jsdom, which parses as browsers do                  |
| LINTEL-DATA-010 | Fixed  | `0ee9d29` | Saving an open page sends its parent only when it was changed there                               |
| LINTEL-DATA-007 | Fixed  | `51bf76d` | A scheduled entry goes live as it was when scheduled; later edits wait                            |
| LINTEL-DATA-008 | Fixed  | `c128f2c` | Deleting a submission deletes only the files it added                                             |
| LINTEL-DATA-009 | Fixed  | `6c2d2c6` | A refund with no clear answer stays pending, so it can't be made twice                            |
| LINTEL-SEC-008  | Fixed  | `1f67cb6` | Approvals and notifications need a browser session, never an API token                            |
| LINTEL-SEC-009  | Fixed  | `e39a979` | Site access for roles needs `roles:update`, the right to give the role, and the sites themselves  |
| LINTEL-SEC-010  | Fixed  | `51a59b1` | Two-factor can't be set up again while on                                                         |
| (tooling)       | Fixed  | `b1d33fb` | `.gitattributes`: LF everywhere, fixtures byte for byte                                           |
| (tooling)       | Fixed  | `6e4c5fa` | The docs test reads page addresses with forward slashes on Windows                                |
| LINTEL-FUNC-015 | Fixed  | `57018d8` | A new entry stays in the editor it was written in after its first save                            |
| LINTEL-FUNC-014 | Fixed  | `e80cda9` | ISK and UGX amounts go to and from Stripe in hundredths                                           |
| LINTEL-SEC-011  | Fixed  | `c7ab588` | Adding a passkey asks for the password                                                            |
| LINTEL-UX-010   | Fixed  | `054b631` | Escape ends text editing on the canvas and keeps the words                                        |
| LINTEL-UX-011   | Fixed  | `4b3a751` | The builder says "Not on your site yet" or "Changes not live yet", and "Published" after Publish  |
| LINTEL-UX-008   | Fixed  | `322e9b9` | New products don't count stock until asked; the list shows "Sold out"                             |
| LINTEL-UX-007   | Fixed  | `e6e5a2d` | A form's Settings warns when email isn't set up                                                   |
| LINTEL-UX-012   | Fixed  | `678178e` | "View website" under the site's name in the sidebar                                               |
| (UX pass)       | Fixed  | `f4cb490` | Settings lists the website's settings first; the roadmap placeholder is gone                      |
| LINTEL-DATA-004 | Fixed  | `0721cd8` | A save sends only the fields changed in that editor (Daniel chose merge per field)                |
| LINTEL-DATA-003 | Fixed  | `123881d` | Renaming a content type field moves entries' saved, published and past values to the new handle   |
| LINTEL-DATA-003 | Fixed  | `575e222` | The same for a field inside a fieldset, in every content type that imports it at the top          |

---

## LINTEL-SEC-001: email outbox

**Before:** `GET /email/outbox` needed only `settings:read`, and showed reset links in full, so an Admin could reset the Owner's password.

**After:**

- The route needs a browser session (`requireAccountSession`) and the Owner role (`OWNERS_ONLY` otherwise). An API token gets 401.
- Any link with a `token=` in an email to someone other than the reader becomes "[link hidden: only the person this was sent to can use it]". This covers password resets, invitations and email confirmations. Other outbox emails (orders, form notifications) carry no secrets.
- Settings and Shop settings show the outbox row to owners only.

**Tests:** `email/outbox.test.ts` covers an admin refused, another owner's link hidden while the reader's own is kept, and API tokens refused. `settings/SettingsPage.test.tsx` covers the row.

## LINTEL-SEC-004: invitation resend

**Before:** `resendInvitation` returned a fresh link to the caller without the role check `inviteSomeone` makes. A `users:invite` role could resend an Owner invitation and accept it.

**After:** resend and cancel call `checkRoleCanBeGranted` for the invitation's role. The original link keeps working.

**Test:** `invitations.test.ts`, "won't resend or cancel an invitation to a role the person can't give".

## LINTEL-SEC-005: site limits in the content tree, recycle bin and search settings

**Before:** `/content-tree/*` and `/recycle-bin/*` checked permissions only, so an editor limited to site A could:

- read site B's tree;
- publish, unpublish, duplicate, move, sort or bin B's pages;
- list, restore or empty B's binned items.

`/seo/entries/:id` had the same gap.

**After:**

- Two helpers in `sites/request-site.ts`:
  - `checkEntriesSiteAccess` checks every entry or parent id a body or query names, in one query;
  - `checkSiteIdAccess` checks `?siteId`, or the default site when none is given.
- `:id` routes use `requireEntrySiteAccess`, as `/entries` does.
- The recycle bin filters by the site recorded in each binned branch. Items from other sites act as not found, and emptying leaves them alone.

**Tests:** `site-access.test.ts` covers 11 refused requests across the tree and SEO routes. A second test covers the recycle bin: list, restore, delete and empty.

## LINTEL-SEC-006: code CSS breaking out of `<style>`

**Before:** a code block's `css` reached the page's `<style>` as typed. `makeCssSafeToEmbed` existed but was never called.

**After:** `compileStylesheet` escapes code CSS, and `DesignHead` escapes `</style` in the whole stylesheet, which covers pages compiled before the fix.

**Tests:** `builder-model/src/code/code.test.ts` and `site-components/src/document/design.test.tsx`.

## LINTEL-SEC-007: code HTML cleaner

**Before:** the builder's own parser read four inputs differently from browsers:

- `<!-->`;
- `</style/>`;
- `<style>` inside `<svg>`;
- `<animate values="javascript:…">`.

All four survived "remove scripts" with working script.

**After:**

- `applyScriptRule` takes the cleaner as an argument.
- Saving on the server (`page-fieldtype.ts`) passes `removeScriptsFromCodeHtml`. It runs DOMPurify on a jsdom window, keeps frames for embeds but not `srcdoc`, and drops `base`, `link`, `meta` and `noscript`.
- The builder's light cleaner stays for the sandboxed canvas.
- New dependencies in core: `dompurify` and `jsdom` (already used for tests elsewhere in the repo). Core's production build passes.

**Tests:** `fieldtypes/code-html-cleaner.test.ts` covers the four inputs, proves the old cleaner misses some, checks that ordinary code HTML comes back unchanged, and checks the usual removals.

## LINTEL-DATA-010: autosave moving a page back

**Before:** every save sent `parentId` from when the editor opened. After a move in the tree, the next autosave moved the page back.

**After:** `updateEntry` takes an `EntryUpdate` whose `parentId` is optional. The classic editor sends it only when it was changed there, and the design save never sends it.

**Test:** `content-workspace/EntryWorkspace.test.tsx`, which checks that a save sends no `parentId`.

## LINTEL-DATA-007: scheduled publishing

**Before:** at the due time `publishedData` was copied from `data`, so edits saved after scheduling went live without the publish checks or approval.

**After:** the scheduler publishes the values in the entry's latest "scheduled" revision, which is written when it is scheduled and never merged into later edits. Later edits stay as unpublished changes. An entry scheduled with no such revision (by an import) goes live as saved, rather than staying stuck.

**Test:** `entry-publishing.test.ts`, "publishes what was scheduled, keeping later edits as unpublished changes".

## LINTEL-DATA-008: form uploads deleting library images

**Before:** the media library keeps one asset per file (a unique content hash). A visitor sending a product photo's bytes got that asset in their submission's `assetIds`, and deleting the submission deleted the photo, because only entries count as uses.

**After:**

- `assetIds` lists only the files the submission created.
- The "still used" check also looks at other submissions' answers.

**Test:** `public-forms.test.ts`, "never deletes a library file a visitor happened to send too".

## LINTEL-DATA-009: refunds with a lost answer

**Before:** any error from the provider marked the pending refund failed, including no answer, a 5xx or a malformed reply. That put the amount back as refundable, and webhooks can't move a refund on from failed.

**After:** for status 0 or 5xx the refund stays pending (its amount stays reserved) and staff see "…shows as pending until Stripe confirms it. Don't refund it again." A 4xx still marks it failed.

**Test:** `commerce.e2e.test.ts`, "keeps a refund pending when Stripe's answer is lost, so it can't be made twice". It uses the fake Stripe's `failNext`.

## LINTEL-SEC-008: approvals and API tokens

**Before:** `/workflow-approvals` used `requireSignedIn`, which accepts any API token and skips the two-factor-setup check. A read-only website token could approve publishing.

**After:** a new guard, `requirePersonInBrowser`, requires a browser session and two-factor set up where the role needs it. Notifications use `requireAccountSession`.

**Test:** `content-approval.test.ts`, "can't be answered with an API token". The old code answered 200.

## LINTEL-SEC-009: site access for roles

**Before:** `PUT /sites/access/:role` needed only `settings:update`, with no check of the role or the actor's own sites. `PATCH` and `DELETE /sites/:handle` didn't check site access.

**After:**

- `PUT /sites/access/:role` also needs `roles:update` and the right to give that role, so only owners can change the Owner role.
- Someone limited to some sites can only move a role among their own sites, and can never open it to every site.
- Editing or deleting a site checks access to it.

**Test:** `site-access.test.ts`, "lets someone limited to some sites change only those, and never their own limit".

## LINTEL-SEC-010: two-factor set up again

**Before:** `POST /account/two-factor/setup` and `/confirm` worked while two-factor was on, swapping the authenticator and recovery codes without the password.

**After:** both answer 409 `TWO_FACTOR_ALREADY_ON`. The admin only offers setup while it's off, so nothing changes for people using it.

**Test:** `two-factor.test.ts`, "can't be swapped for another phone while on, without the password".

## Second round

The same way: a test that fails on the old code first. The screens were also checked in Chromium at 1440px and 390px, light and dark, against the UX pass's data folder. The screenshots are in `screenshots/fix-security/`, prefixed `fix-`.

### LINTEL-FUNC-015: a new entry's first save

**Before:** the address changing from `/new` to the entry's id made `EntryWorkspacePage` swap the classic editor for the workspace, so focus and words typed during the save were lost.

**After:** the page remembers the entry it created and keeps the classic editor, whose key `useEditorKey` already keeps.

**Test:** `content-workspace/EntryWorkspacePage.test.tsx`, which types across the save and checks the same input keeps focus and every word.

### LINTEL-FUNC-014: ISK and UGX at Stripe

**Before:** Stripe treats ISK and UGX as two-decimal currencies; Lintel (rightly, for display, PayPal and Mollie) as zero-decimal. ISK 10,000 went to Stripe as ISK 100, and the paid total matched.

**After:** `money/stripe-amounts.ts` converts every amount going to Stripe (line prices, tax line, coupon, delivery, payment intent, refund, Stripe Tax lines) and every amount coming back (paid totals, tax, refunds made in Stripe).

**Test:** `commerce.e2e.test.ts`, "charges the full price in Icelandic krónur…".

### LINTEL-SEC-011: passkeys

**After:** `POST /account/passkeys/options` asks for the current password (rate-limited like sign-in); finishing needs the challenge it issues. The "Add a passkey" dialog has a Current password field (`fix-passkey-*.png`).

**Test:** `passkeys.test.ts`, "asks for the password before adding a passkey".

### LINTEL-UX-010: Escape in the builder

**After:** Escape ends editing and keeps the words, as clicking away does; Undo takes them back.

**Test:** a browser test in `builder/src/browser-tests/canvas-free-layout.test.ts`.

### LINTEL-UX-011: Publish in the builder

**After:** beside "Saved", the top bar says "Not on your site yet" (never published) or "Changes not live yet" from 640px up. After Publish the button reads "Published" for four seconds, and screen readers hear "Published. Your changes are on your site."

**Test:** `PageDesignPage.test.tsx`, "says the page isn't on the site yet, and confirms when Publish has worked".

### LINTEL-UX-008: new products sold out

**After:** a new product in the admin doesn't count stock until the owner switches it on (the API's default is unchanged). A product on sale with tracked stock of 0 shows "Sold out" in the list (`fix-products-*.png`).

**Tests:** `ShopScreens.test.tsx` and `shopHelpers.test.ts`.

### LINTEL-UX-007: form emails with no mail service

**After:** `GET /email/status` (anyone signed in) says only whether emails go out. A form's Settings shows "Email isn't set up on this website yet, so these emails won't be sent. New messages still arrive in Submissions." while either email is on (`fix-form-email-warning-*.png`).

**Tests:** `FormSettingsSection.test.tsx` and `outbox.test.ts`.

### LINTEL-UX-012: View website

**After:** "View website" (new tab) under the site's name in the sidebar, once the website has an address. Opening the phone menu now focuses its close button, as before, rather than the first link (`fix-sidebar-*.png`).

**Test:** `AdminLayout.test.tsx`.

### Settings order (UX pass)

**After:** the Site group (Your website, Features, Sites, Languages) comes first; the "More site settings… later phases of the roadmap" row is gone, which also covers that item on `fix/qa-leftovers` (`fix-settings-order-*.png`).

**Test:** `SettingsPage.test.tsx`.

### LINTEL-DATA-004: two editors on one entry

Daniel's decision for SPEC-004: merge per field. Different fields edited by two people both survive; the same field edited by both keeps the last save.

**Before:** every save sent every field, so the second editor's save put back the values they had opened.

**After:** `changesSince(saved, current)` in `entryDraft.ts` picks the fields, slug and parent changed since the editor's last save, and only those are sent; the API already keeps whatever isn't sent. The builder's save sends only the design. This also replaces the earlier parent-only rule for LINTEL-DATA-010.

**Tests:** `entryDraft.test.ts` ("what a save sends") and `EntryWorkspace.test.tsx`, "saves only the fields changed here…".

### LINTEL-DATA-003: renaming a field's handle

Daniel's decision: move the values.

**Before:** entries kept values under the old handle; the website lost them at once and the next save of each entry dropped them.

**After:**

- The admin knows which saved fields had their handle changed (each field's key is `saved:<handle as loaded>`), and sends `renames: [{ from, to }]` with `PUT /blueprints/:handle` and `PUT /fieldsets/:handle`.
- The API checks each is a real rename (old handle there before, new one there now, old one gone) and, in the same transaction, moves the values in entries' saved and published values and every revision (`entries/field-renames.*`). For a fieldset, the values move inside the group each content type imports it as.
- The handle hint now says the content moves with it, and that page designs and code using the old handle need updating.

**Not covered yet:** fields inside groups, repeaters or blocks; fieldsets inside those or in global sets; collection list bindings in page designs (`data.<old>`), which still need changing by hand.

**Tests:** `blueprints.test.ts`, "moves entries' values to a field's new handle, live and in History"; `fieldsets.test.ts`, "moves entries' values when a field in a fieldset is renamed"; `blueprintDraft.test.ts`, "renamed handles".

## Still open from batch 3

Highest first:

- **P1:**
  - LINTEL-DATA-011 and LINTEL-FUNC-016 (updates: rollback schema, Windows junctions; hosting is deprioritised);
  - LINTEL-UX-006 and LINTEL-UX-009, with the other two redesigns (approved by Daniel; next).
- **P2:** the rest of the batch 3 table, and DATA-003's uncovered cases above.

## Security batch (4 November)

### LINTEL-SEC-002: global search leaked other sites' titles

**Reproduced:** with Pierre's role limited to the French site, `GET /search?q=Secret` returned the default site's "Secret launch plan" too. **Fix:** `/search` passes the person's allowed sites to the entry search, which filters by them (`search.repository.ts`), as the content tree does. **Test:** `site-access.test.ts`, "keeps someone to their sites in global search" (fails without the fix).

### LINTEL-SEC-012: webhook signing secrets shown to settings readers

**Reproduced:** a person with only `settings:read` got each webhook's `secret` from `GET /webhooks` and `GET /webhooks/:id`, enough to forge deliveries the receiving app would trust. **Fix:** the secret comes back only for people with `settings:update`; others get `null`, and the webhook screen says "Only people who can change webhooks can see the signing secret." **Tests:** `webhooks.test.ts` (fails without the fix), `Webhooks.test.tsx`.

### LINTEL-SEC-013: no limit on password guesses for two-factor changes

**Reproduced:** eleven wrong passwords in a row to `/account/two-factor/disable` were all answered. **Fix:** that and `/account/two-factor/recovery-codes` allow ten tries per address in fifteen minutes, as `/account/password` does. **Test:** `two-factor.test.ts` (fails without the fix).

### LINTEL-SEC-014: basket tokens in the request log

**Reproduced:** `hideSecretsInUrl` left `/delivery/shop/carts/<token>` as it was; the token opens the shopper's basket with their email and address. **Fix:** the token in the path is replaced with `[hidden]` (`request-logging.ts`). **Test:** `security-headers.test.ts`, "hide a basket's token in its address" (fails without the fix).

### LINTEL-SEC-003: still open

The script rule is applied only when a page is saved. The fix is to apply the current rule again when the website draws a design, but designs are drawn in four places (one, `toPageView`, without access to settings), and rendered pages are cached, so the cache would need clearing when the rule changes. Left for a careful change of its own.

## Content and fields batch, part 1 (4 November)

### LINTEL-FUNC-009: deeply nested rich text broke the entry

**Reproduced** in the field check: a Body of 2,000 nested quotes overflowed the stack. **Fix:** rich text may nest at most 50 levels, checked when saved by a walk without recursion, before the editor's own check (`rich-text.ts`). The message: "Body is nested too deeply: at most 50 levels, such as quotes inside quotes". **Test:** `fieldtypes.test.ts` (fails without the fix).

### LINTEL-UX-004: no title length limit

**Reproduced:** a 301-character title was accepted. **Fix:** a top-level title may be at most 300 characters whatever its content type says (`entry-data-validator.ts`), and the title box stops there. The Content screen's lists are one column that can't be stretched (`grid-cols-1`, `min-w-0`): at 390px with a 300-character title the page stays 390px wide (it measured 95,998px). **Test:** `entries.test.ts` (fails without the fix).

### LINTEL-FUNC-013: lists showed a select's stored value

**Fix:** routed collections carry their choice fields' labels (`choiceLabelsOf`), and list items use them, on the website and in the builder's samples: "web" shows as "Web", lists of choices as "Online, Paper". **Test:** `bound-entries.test.ts`.

Still to do in this batch: DATA-005 (a new condition clears existing values), FUNC-008 (type changes and removed choices make entries unsaveable), SPEC-003 (slugs unique across a whole tree).
