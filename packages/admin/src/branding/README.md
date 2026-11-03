# Branding (admin)

What the admin looks like for an agency's clients: the name, logo, mark, favicon, accent
colour, sign-in screen and help links. The rules and the three layers (Lintel, the
deployment, Settings) live in `packages/core/src/branding`; this folder shows them.

| File                     | What it does                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `branding.api.ts`        | Calls to `/branding`                                                        |
| `brandingStore.ts`       | The current branding; `useBranding()`; loaded before the first draw         |
| `applyBranding.ts`       | Accent tokens, favicon and theme colour on the page itself                  |
| `useDocumentTitle.ts`    | "Media · Acme Studio" in the tab, called by `LargeTitle` and `DisplayTitle` |
| `BrandLogo.tsx`          | The logo, or the mark and name, as the sidebar and corners show it          |
| `BrandingPage.tsx`       | Build → Admin branding (`branding:update`)                                  |
| `BrandingImageField.tsx` | Choose, preview and remove a picture                                        |
| `AccentColourField.tsx`  | The colour, a light and dark preview, and the contrast warning              |
| `branding.queries.ts`    | Saving and resetting, then showing the new look everywhere                  |

The product name reaches every message through `{product}` (see `src/i18n`). The last
branding seen is remembered in localStorage, so a branded admin doesn't flash Lintel's
violet while it loads.
