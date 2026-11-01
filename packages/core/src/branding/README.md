# Branding

Agencies sell Lintel to clients who should see the agency's (or their own) name, logo and
colour, not Lintel's. This folder decides what the admin, its emails and the public site's
"Built with Lintel" credit look like.

Branding comes in three layers, each on top of the one before:

1. **Lintel's own look** (`lintelBranding` in `branding.schema.ts`).
2. **The deployment's**: the `branding` section of `lintel.config.json`, then the
   `LINTEL_BRAND_*` environment variables (`deployment-branding.ts`). Read once at start,
   so it also applies to the setup screens of a fresh install.
3. **Settings → Branding** in the admin. Only fields that differ from the deployment are
   saved (the `brandingOverrides` setting), so a later deployment change still reaches the
   rest. "Reset" empties it.

| File                     | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `branding.schema.ts`     | Every branding field, its rules, and Lintel's defaults               |
| `accent-colours.ts`      | One colour in, accessible link, hover and button-text shades out     |
| `deployment-branding.ts` | Reads `lintel.config.json` and `LINTEL_BRAND_*`                      |
| `branding.service.ts`    | Combines the layers, saves, resets, and turns uploads into addresses |
| `branding.routes.ts`     | `GET /branding` (public), `/branding/settings`, `PUT`, `DELETE`      |
| `branded-email.ts`       | The frame every email is sent in: name, logo, colour, support email  |
| `branding.errors.ts`     | `BrandingImageNotFoundError`                                         |

`accent-colours.ts` is shared with the admin as `@lintel/core/accent-colours`, so the
Branding screen's preview and its contrast warning match what the server hands out.

Uploaded pictures are kept as data URLs in the setting and served from
`/branding/images/:field?v=<fingerprint>` with a strict Content-Security-Policy, so an
uploaded SVG can't run scripts. Changing branding needs the `branding:update` permission
(Super admins have it).

User-facing docs: `packages/docs/src/content/docs/building/branding.md`.
