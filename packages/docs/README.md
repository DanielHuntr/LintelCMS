# @lintel/docs

Lintel's documentation site, built with [Astro Starlight](https://starlight.astro.build)
from the Markdown in this folder. It is also where the admin's help panel gets its pages:
the "Using Lintel" pages are bundled into the admin through `@lintel/docs/help`, so help
works offline and always matches the docs. See `docs/decisions/0010-docs-with-starlight.md`.

## Commands

```bash
pnpm --filter @lintel/docs dev       # http://localhost:4321, reloads as you edit
pnpm --filter @lintel/docs build     # static site in dist/, with the search index
pnpm --filter @lintel/docs preview   # serve the built site
pnpm --filter @lintel/docs test      # every page listed, links and screenshots real
```

The root `pnpm dev` doesn't start the docs; `pnpm docs:dev` does.

## Where things live

| Path                         | What it is                                                        |
| ---------------------------- | ----------------------------------------------------------------- |
| `src/content/docs/using`     | "Using Lintel": for editors and site owners, no code              |
| `src/content/docs/building`  | "Building with Lintel": for developers                            |
| `src/content/docs/index.mdx` | The home page                                                     |
| `src/assets/screens`         | Screenshots of the admin (1440 × 900, light mode)                 |
| `src/sidebar.ts`             | The sidebar, in reading order                                     |
| `src/version.ts`             | The Lintel version these docs describe                            |
| `src/components`             | Starlight overrides: the version beside the title, "Since" labels |
| `src/styles/lintel.css`      | The admin's fonts, accent and greys                               |
| `src/help`                   | The bundle the admin's help panel imports                         |
| `src/content.test.ts`        | Checks on the docs themselves                                     |

## Writing a page

1. Add a Markdown file under `using/` or `building/` with `title`, a one-line
   `description` and `since` (the version that introduced it).
2. Add its slug to `src/sidebar.ts`.
3. Link to other pages with absolute paths ending in a slash: `[Media](/using/media/)`.
4. Put screenshots in `src/assets/screens` and link them relatively:
   `![What it shows](../../../assets/screens/media-library.png)`.

"Using Lintel" pages use plain Markdown only (no MDX components), because the admin renders
them too. Name buttons as the admin shows them, in **bold**.

## Versions

`src/version.ts` holds the documented version, shown beside the site title. Each page's
`since` appears beside its title, marked "New in" when it matches the current version.
`since` is a release (`"0.6"`) or, for what is only in a release candidate so far, the
candidate (`"1.0.0-rc"`, shown as "Since the 1.0 release candidate"). Don't call anything
`"1.0"` until that release is out.
When a release ships, bump the version; when pages describe something that changed, say so
on the page ("Before 0.2, ...") rather than keeping a copy of the old docs.

## Search, dark mode and edit links

All from Starlight: search is a [Pagefind](https://pagefind.app) index built with the site
and searched in the browser, dark mode follows the device with a switch in the header, and
every page links to its file on GitHub ("Edit page"). Set `DOCS_SITE_URL` when publishing,
for canonical links and the sitemap.
