# Design system

The base components every admin screen is built from, and the tokens they use. The goal is an
admin that feels like a well-made Mac or iPhone app: calm, spacious and precise. Review every
component in light and dark at `/design-system` (see `src/design-review`).

## Tokens

All tokens live in `src/styles.css`. Components only use tokens, never fixed colours.

| Token                                        | What it is for                                                       |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `background`                                 | The page behind cards and lists (light grey, black in dark mode)     |
| `surface`                                    | Cards, grouped lists, the sign-in card                               |
| `surface-raised`                             | Something lifted off a surface (lighter grey in dark mode)           |
| `sidebar`                                    | The translucent sidebar; blurred with `backdrop-filter`              |
| `fill`, `fill-strong`                        | Text fields, segmented-control tracks, hover, the toggle's off track |
| `segment`, `knob`                            | The selected segment of a SegmentedControl; the Toggle's knob        |
| `separator`                                  | Hairlines between rows (`hairline-top`, `hairline-ring`)             |
| `label`, `label-secondary`, `label-tertiary` | Text, from most to least important                                   |
| `accent`                                     | Links, tinted buttons, the selected sidebar item                     |
| `accent-fill`, `on-accent`                   | Filled buttons, the toggle's on track, and the text on them          |
| `success`, `warning`, `danger`               | Status colours for badges, list icons and errors                     |
| `scrim`                                      | The dimmed layer behind dialogs and sheets                           |

Non-colour tokens: the type scale (`text-display` for full-screen questions, `text-large-title`, `text-title`, `text-headline`,
`text-body`, `text-footnote`, `text-caption`, each with its own line height and tracking),
radii (`rounded-control` 8px, `rounded-card` 12px, `rounded-panel` 14px), shadows
(`shadow-float` for things that float, `shadow-thumb` for knobs) and `ease-standard`.

Tailwind's default palette is switched off, so `bg-stone-100` and friends don't exist. That's
deliberate: every colour has to come from a token so the whole admin can be rebranded.

### Light and dark

The colour tokens are set twice in the base layer of `styles.css`: light first, then dark inside
`@variant scheme-dark`. Dark applies when the device prefers dark mode, or inside any element
with `data-color-scheme="dark"`; `data-color-scheme="light"` forces light. Change a value in
one place and both the real admin and the review page follow.

We don't use CSS `light-dark()` because Tailwind's CSS compiler rewrites it in a way that only
follows the device's setting, which would stop the review page showing both schemes at once.

### Contrast

The accent is Lintel violet, split in two. `accent-fill` (`#7539fd`, the brand colour) sits
behind white text on buttons (5.6:1). `accent` is used for text: a shade deeper in light mode
(`#6a2cf0`, 6:1 on the grey background) and lighter in dark mode (`#a68aff`, 5.1:1 even on
raised panels), so links pass WCAG AA everywhere. The mark (`AppMark`) is the bird from
`brand/` at the repository root.

## Rebranding for a client

Override the colour tokens after `styles.css` is loaded, for both schemes:

```css
:root,
[data-color-scheme] {
  --color-accent: #8a3ffc;
  --color-accent-fill: #7c3aed;
  --color-on-accent: #ffffff;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-color-scheme="light"]) {
    --color-accent: #b38cff;
  }
}
```

Check two things after rebranding: `on-accent` text on `accent-fill` reaches 4.5:1, and `accent`
text on `surface` reaches 4.5:1 in both schemes. Renaming the app in `src/i18n/strings.ts`
also changes the text mark (`AppMark`), which shows the first letter of the app name.

## Components

| File                   | What it is                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `Button.tsx`           | `filled` (the main action), `tinted`, `plain`, `destructive`; `small` to `extra-large` |
| `LinkButton.tsx`       | A link that looks like a Button, for actions that go to another screen                 |
| `BackLink.tsx`         | "‹ Settings" above a page title                                                        |
| `TextField.tsx`        | A labelled input with an optional hint or error; `fieldSize="large"` for setup         |
| `Card.tsx`             | A rounded surface with an optional title and accessory                                 |
| `GroupedList.tsx`      | An iOS Settings-style inset group of rows, with header and footer                      |
| `GroupedListRow.tsx`   | A row: icon, label, description, detail, accessory, and a chevron when it navigates    |
| `Toggle.tsx`           | An on/off switch (`role="switch"`)                                                     |
| `SegmentedControl.tsx` | A pill of exclusive choices (a radio group; arrow keys move the choice)                |
| `Badge.tsx`            | A short coloured status label                                                          |
| `LargeTitle.tsx`       | The page header: the page's `h1`, subtitle and actions                                 |
| `EmptyState.tsx`       | What to show when there is nothing yet                                                 |
| `SearchField.tsx`      | A search box with a magnifying glass                                                   |
| `Skeleton.tsx`         | A grey shape standing in for content that's loading; wrap in `LoadingRegion`           |
| `Dialog.tsx`           | A modal on the native `<dialog>`: `alert` for questions, `sheet` for tasks             |
| `ConfirmDialog.tsx`    | "Are you sure?" before deleting or restoring, instead of the browser's `confirm()`     |
| `Menu.tsx`             | A button that opens a short list of actions (the ARIA menu button pattern)             |
| `controlStyles.ts`     | The shared look of inputs, text areas and selects                                      |
| `AppMark.tsx`          | The app's text mark                                                                    |
| `PasswordField.tsx`    | A TextField with a "Show password" toggle button (`aria-pressed`)                      |
| `EmailField.tsx`       | A TextField that offers a one-click fix for domain typos such as "gmai.com"            |
| `ChoiceCardGroup.tsx`  | Large tiles with an icon and a line each; a radio group like SegmentedControl          |
| `DisplayTitle.tsx`     | The big h1 of full-screen screens such as setup and sign-in                            |
| `CopyButton.tsx`       | Copies text and says "Copied" (announced to screen readers too)                        |
| `SelectField.tsx`      | A labelled native select with an optional hint                                         |
| `Avatar.tsx`           | A person's picture, or their initials on the accent colour                             |

Helpers: `suggestEmailCorrection.ts` (the typo check behind EmailField: popular domains and
edit distance, never blocking) and `radioGroupKeys.ts` (the arrow-key rules every radio group
shares).

## Rules

- Motion is 150–250ms with `ease-standard`. Presses scale down slightly, only under
  `motion-safe:`. `styles.css` turns transitions off for people who ask for reduced motion.
- Focus is always visible: `focus-visible:focus-ring` (or `focus-ring-inset` inside clipped lists).
- Use space, not borders, to separate things. Hairlines are only for rows in a list.
- Icons come from `lucide-react` with `aria-hidden="true"`; the text next to them is the label.
