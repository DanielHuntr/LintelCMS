# SEO

The admin side of the SEO plugin. Nothing here shows while the plugin is off.

- **The editor's Search engines panel** (`EntrySeoPanel`, in the entry side panel): a
  search result preview that follows the title and slug as they're typed, the title and
  description with advice on their length ("48 of about 60 characters · A good length"),
  the image for social networks and "Hide from search engines". It saves a moment after
  typing stops. New entries show it once they have been saved.
- **Settings → Search engines** (`/settings/seo`): site name, website address, the page
  title pattern (with a live example), default description and image, and "Ask search
  engines not to list this site". Links to the redirects and shows the sitemap and
  robots.txt addresses.
- **Redirects** (`/settings/seo/redirects`): suggestions from pages that moved, each with
  Accept and Dismiss; the active redirects; adding one (for good or for now, explained in
  words); and importing a CSV file or pasted rows, with a summary of what went in and
  which lines were skipped.

Titles are built with `@lintel/core/seo-titles`, the same code the API uses, so the
preview matches what websites get. The preview takes its colours from the design tokens.

| File                           | What it does                                  |
| ------------------------------ | --------------------------------------------- |
| `EntrySeoPanel.tsx`            | The editor panel                              |
| `SearchPreview.tsx`            | The search result preview                     |
| `LengthGuidance.tsx`           | Length advice under the title and description |
| `SeoSettingsPage.tsx`          | The site defaults                             |
| `RedirectsPage.tsx`            | Suggestions and redirects                     |
| `AddRedirectDialog.tsx`        | Adding a redirect                             |
| `ImportRedirectsDialog.tsx`    | Importing from CSV                            |
| `seo.api.ts`, `seo.queries.ts` | Calls to the API, and their caching           |
