# Lintel + Next.js starter

A small, complete website that shows the content you write in Lintel. It has:

- a **home page**, with your page called `home` and your latest blog posts;
- your **pages**, at `/about-us`, `/contact` and so on;
- a **blog**, at `/blog`, ten posts a page;
- each **blog post**, at `/blog/<post-address>`.

Photos are cropped around the subject you marked in Lintel, in the right size for each
screen. When you publish something in Lintel, the site shows it within a minute.

## What you need

- **Node.js 22 or newer** and **pnpm 10** (the same as Lintel).
- **Lintel running**, with something published. If you haven't set Lintel up yet, follow
  "Getting started" in the main [README](../../README.md) first.

## 1. Point it at Lintel

Copy the example settings file:

```bash
# macOS and Linux
cp starters/nextjs/.env.example starters/nextjs/.env.local
```

```powershell
# Windows PowerShell
Copy-Item starters/nextjs/.env.example starters/nextjs/.env.local
```

Open `starters/nextjs/.env.local` in a text editor. The defaults work with a Lintel running
on your computer; change `SITE_NAME` to your site's name.

| Setting             | What it is                                             | Default                 |
| ------------------- | ------------------------------------------------------ | ----------------------- |
| `LINTEL_API_URL`    | Where Lintel's API is                                  | `http://localhost:4000` |
| `SITE_NAME`         | Shown in the header and the browser tab                | `My Lintel site`        |
| `REVALIDATE_SECRET` | A password for refreshing pages straight away (step 5) | empty: switched off     |

## 2. Start it

Keep Lintel running (`pnpm dev` in one terminal). In a second terminal, from the Lintel
folder:

```bash
pnpm --filter starter-nextjs dev
```

Open **http://localhost:3000**. The root `pnpm dev` doesn't start this site, so you only
run it when you want it.

**"This site can't reach Lintel yet"** means Lintel isn't running, or `LINTEL_API_URL` is
wrong. Start Lintel and reload.

## 3. Add your content in Lintel

- **Home page:** in Lintel, go to **Content**, then **Pages**, and make a page whose address
  is `home`. Its title, summary, hero image and body fill the top of the home page.
- **Other pages:** every published page appears at its address, and the first five appear
  in the header.
- **Blog:** published blog posts appear on the home page and at `/blog`. If your site has
  no blog, switch the Blog feature on in Lintel; until then the blog links are hidden.

Drafts never appear. Press **Publish** in Lintel, wait up to a minute, and reload.

## 4. Make it yours

| To change                     | Edit                                              |
| ----------------------------- | ------------------------------------------------- |
| Colours, fonts and spacing    | `app/globals.css` (the variables at the top)      |
| The header and footer         | `components/SiteHeader.tsx`, `app/layout.tsx`     |
| The home page                 | `app/page.tsx`                                    |
| How a page or a post looks    | `app/[slug]/page.tsx`, `app/blog/[slug]/page.tsx` |
| How posts look in lists       | `components/PostCard.tsx`                         |
| How many posts the blog shows | `POSTS_PER_PAGE` in `lib/site.ts`                 |

### Adding a field

Say you add a "Reading time" number field to Blog posts in Lintel (**Settings**, then
**Content types**), with the handle `reading_time`.

1. Update the types from your content model. From the Lintel folder, with Lintel stopped
   (or using Postgres):

   ```bash
   pnpm --filter @lintel/core model types --from database --out starters/nextjs/lib/lintel.generated.ts
   ```

   If your site keeps its content model in code (a `content-model` folder), leave out
   `--from database`. `PostData` now has `reading_time: number | null`.

2. Show it, for example in `app/blog/[slug]/page.tsx`:
   `{post.data.reading_time && <p>{post.data.reading_time} min read</p>}`

TypeScript tells you everywhere a renamed or removed field is still used.

### Adding a content type

Say you make "Recipes" in Lintel, with the handle `recipes`.

1. Update the types as above. `getEntry("recipes", slug)` now knows a recipe's fields.
2. Copy `app/blog/[slug]/page.tsx` to `app/recipes/[slug]/page.tsx`, and change
   `getEntry("posts", slug)` to `getEntry("recipes", slug)`.
3. For a list, copy `app/blog/BlogIndex.tsx` the same way.

## 5. Publishing changes straight away (optional)

Pages refresh in the background at most once a minute. To refresh them now (from a deploy
script, say), set `REVALIDATE_SECRET` to a long random password
(`openssl rand -hex 32` makes one) and call:

```bash
curl -X POST -H "authorization: Bearer YOUR_SECRET" \
  "http://localhost:3000/api/revalidate?collection=posts"
```

Leave out `?collection=posts` to refresh everything.

## 6. Putting it online

```bash
pnpm --filter starter-nextjs build
pnpm --filter starter-nextjs start
```

Any host that runs Next.js works (Vercel, Netlify, a server with Node.js). Set the same
settings there as in `.env.local`, with `LINTEL_API_URL` pointing at where your Lintel
runs online. On the Lintel side, set `API_PUBLIC_URL` to that address too, so image links
work for your visitors.

If Lintel can't be reached while the site builds, the build still finishes: pages are
then made on their first visit instead.

## How it works

| File                          | What it does                                                                |
| ----------------------------- | --------------------------------------------------------------------------- |
| `lib/lintel.ts`               | `getEntry` and `listEntries`: typed reads from Lintel, cached for a minute  |
| `lib/lintel.generated.ts`     | Types and a client made by `model types` from the content model; don't edit |
| `lib/content-types.ts`        | Short names for the generated types                                         |
| `lib/images.ts`               | Image addresses, resized and cropped by Lintel                              |
| `components/LintelImage.tsx`  | A responsive image that loads the right size                                |
| `components/RichText.tsx`     | Shows a rich text field                                                     |
| `app/api/revalidate/route.ts` | Refreshing pages straight away                                              |

It reads Lintel's public delivery API, which only ever serves published content. The
full reference is in Lintel's docs: "Building with Lintel", then "Delivery API".

```bash
pnpm --filter starter-nextjs test        # the helpers' tests
pnpm --filter starter-nextjs typecheck
```

### Taking it out of the Lintel folder

The starter doesn't depend on anything else in the Lintel repository. Copy the
`starters/nextjs` folder anywhere, run `pnpm install` (or `npm install`) inside it, and
use `pnpm dev`, `pnpm build` and `pnpm start` there.
