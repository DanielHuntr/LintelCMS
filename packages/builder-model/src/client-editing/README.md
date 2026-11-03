# Client editing

Agencies design a site, then let their clients change its content without touching the
design. Each element says what clients may change (`clientEdits` on the node: words,
pictures, links, or nothing), and a container can let them add and remove its items
(`clientRepeats`). Left out, each element's defaults apply: text gives words, pictures give
pictures, buttons and links give words and links, layout and everything else give nothing.
docs/decisions/0053-content-only-editing-for-clients.md explains the choices.

| File                | What it holds                                                                |
| ------------------- | ---------------------------------------------------------------------------- |
| `client-content.ts` | What kind of content each field holds, the defaults, and what a client sees  |
| `client-changes.ts` | `findDesignChanges`: a client's save against the stored page, for the server |

The server refuses a save from someone without `builder:design` when `findDesignChanges`
finds anything (see `packages/core/src/client-editing`). The builder uses
`clientEditableFields` and `clientMayEditText` to show a client only what they may change.

## What counts as content

| Field kind                                 | Content  |
| ------------------------------------------ | -------- |
| text, multiline text, list of text         | words    |
| picture (and its media id and description) | pictures |
| link, list of links                        | links    |
| anything else (choices, toggles, numbers)  | never    |

A text's styled parts (`marks`) may move as its words change, but only to looks the text
already had. A copy made by "Add another" must match an item that was there (or the list's
new item) apart from the content clients may change; items keep their order, and at least
one stays.
