# Appearance

Light or dark. The admin follows the device's setting (`prefers-color-scheme`) unless the
person chooses otherwise from the command palette ("Switch to dark mode", "Switch to light
mode", "Match my device"). The choice belongs to this browser: it is kept in localStorage
(`lintel.colorScheme`) and applied before the first screen is drawn (`main.tsx`), so the
admin never flashes in the other scheme.

`colorScheme.ts` sets `data-color-scheme` on `<html>`; `styles.css` (the `scheme-dark`
variant) and the agency's branding colours (`branding/applyBranding.ts`) both follow it, as
they already did for the design review page.
