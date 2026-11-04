# Fix log: working together (`feature/collaboration`, 4 November 2026)

Who is here, safe saving and live editing. The decision is
`docs/decisions/0067-working-together-on-a-page.md`; the guide is `using/working-together`.

Checked in Chromium on a real install (fresh Lintel folder, API 4791, site 4792, admin 5791) with
two and three people signed in at once, by `packages/admin/e2e/collaboration.e2e.mjs`. Screenshots
are in `screenshots/collaboration/`.

## Built

| ID            | What it is                                                                         | Proof             |
| ------------- | ---------------------------------------------------------------------------------- | ----------------- |
| LINTEL-UX-350 | Avatars of who else is on the page, in the top bar both views share                | test, e2e, looked |
| LINTEL-UX-351 | Pressing them says who, and whether they're designing or editing content           | test, e2e         |
| LINTEL-UX-352 | Small avatars on tree rows of pages someone has open                               | test, e2e, looked |
| LINTEL-UX-353 | One connection per browser, however many tabs                                      | e2e               |
| LINTEL-UX-354 | Reconnects by itself, with a calm "Reconnecting…" in the designer                  | test, e2e, looked |
| LINTEL-UX-355 | Blocked connection: nothing shows, nothing waits, pages save as before             | e2e               |
| LINTEL-UX-356 | A second person's save can't overwrite the first                                   | test, e2e         |
| LINTEL-UX-357 | Saves that don't clash merge without asking                                        | test, e2e         |
| LINTEL-UX-358 | A clash asks, naming who and what, with Keep mine and Use theirs                   | test, e2e, looked |
| LINTEL-UX-359 | What isn't chosen stays in History, marked "Set aside when changes clashed"        | test, e2e         |
| LINTEL-UX-360 | Others' pointers and selections on the canvas, with names, in each person's colour | e2e, looked       |
| LINTEL-UX-361 | Design changes merge live                                                          | test, e2e         |
| LINTEL-UX-362 | Undo takes back only your own changes                                              | test, e2e         |
| LINTEL-UX-363 | Edits made during a dropped connection merge on its return                         | test, e2e         |
| LINTEL-UX-364 | Content view: a field says who is typing in it                                     | e2e, looked       |
| LINTEL-UX-365 | Content view: others' saved fields arrive without a reload, and keep your typing   | test, e2e         |
| LINTEL-UX-366 | Client and designer on one page; the server holds the client to their rules        | test, e2e         |
| LINTEL-UX-367 | A/B versions and the navigation and footer say so before saving over someone       | test              |

## Found and fixed on the way

Each was reproduced first.

| ID            | Severity | What was wrong                                                                                           | Fix                                                                    | Proof       |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------- |
| LINTEL-UX-368 | P1       | Two saves of different fields at the same moment could lose one: each merged over what it had read       | The write is conditional on the version read; the loser reads again    | test        |
| LINTEL-UX-369 | P1       | The designer asked to open a design before saying it was on the page, was refused, and saved the old way | The page is entered first                                              | e2e         |
| LINTEL-UX-370 | P2       | A dropped network went unnoticed for up to 45 seconds, with changes going nowhere                        | The browser's `offline` event closes the connection at once            | e2e         |
| LINTEL-UX-371 | P2       | One enormous change would have been cut off, reconnected and sent again for ever                         | Steps go in parts, and one too big to send is taken back and explained | test        |
| LINTEL-UX-372 | P2       | "Couldn't save" and an error showed behind the question when changes clashed, though nothing had failed  | The save is held, not failed                                           | e2e, looked |
| LINTEL-UX-373 | P3       | Words typed on the canvas could put back someone else's change to the same words                         | Typed words carry what they started from, and merge                    | test        |

## Checked in a browser

| Check                                                             | Desktop light | Desktop dark | 390px light | 390px dark |
| ----------------------------------------------------------------- | ------------- | ------------ | ----------- | ---------- |
| Top bar avatars                                                   | Yes           | Yes          | Yes         | Yes        |
| Nothing spills sideways                                           | Yes           | Yes          | Yes         | Yes        |
| The question when changes clash                                   | Yes           | Yes          | Yes         | Yes        |
| Canvas pointers and selections                                    | Yes           | Yes          | n/a         | n/a        |
| Reconnecting, client beside designer, field note, design question | Yes           | No           | n/a         | n/a        |

The designer doesn't open at 390px (LINTEL-UX-013), so its rows are n/a.

## Not checked

Firefox and Safari; the hosted app under real Passenger; a real slow or lossy network (the drop is
cut by the test, not by a network); more than three people at once.
