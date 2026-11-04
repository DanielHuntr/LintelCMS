# Instagram feed

A Lintel add-on that shows your latest Instagram posts on your website: as an **Instagram
feed** element in the builder, or `{% instagram_feed %}` in a Liquid template.

## Privacy

Visitors never load anything from Instagram. Every hour the server asks Instagram for the
newest posts, copies each picture (a video's still, for videos) into the add-on's own table
and serves it from the website's own address. Each post links to Instagram with a plain
link, which loads nothing until a visitor follows it, so the cookie notice has nothing to
ask about. The access token stays on the server: the admin only ever sees its last four
characters.

## Setting it up

1. Install it: `lintel addons add @lintel/addon-instagram` (or a packed `.tgz` of this
   folder), then restart Lintel. It appears in Build → Add-ons, switched on.
2. Your Instagram account needs to be a Business or Creator account.
3. At developers.facebook.com, make an app and add the "Instagram API with Instagram login"
   product. Under "Generate access tokens", add your account and generate a token.
4. Open **Instagram** in the admin's sidebar and paste the token. Your posts are copied
   straight away.
5. Add the **Instagram feed** element to a page (Insert → Instagram).

How many posts to keep (3 to 24, 12 to start with) is a setting on the Add-ons screen.
Tokens last 60 days; the add-on renews yours every day, so it doesn't run out while the site
is running. Choosing a post on the Instagram screen lets you describe its picture for people
who use a screen reader; otherwise the caption's first line is used.

## On the website

| Where                                       | What it shows                                                   |
| ------------------------------------------- | --------------------------------------------------------------- |
| The **Instagram feed** element              | Heading, 2, 3 or 4 columns, and a link to your profile (on/off) |
| `{% instagram_feed %}`                      | The posts in a grid of 3, drawn on the server                   |
| `{% instagram_feed limit: 6, columns: 2 %}` | Fewer posts, wider pictures                                     |
| `{% instagram_feed profile_link: false %}`  | Without the link to your profile                                |

The element's pictures are filled in by a few lines of script once the page loads, because
an element is drawn without the database. Without scripts it shows a line of text. Both use
the class names `instagram-feed`, `instagram-feed__grid`, `instagram-feed__post` and
`instagram-feed__profile`, and the `--instagram-columns` custom property, for a site's own
styles. A static export of a site has no API to ask, so use the Liquid tag there.

## Endpoints

All answer 404 `PLUGIN_NOT_ENABLED` while the add-on is off.

| Method and path                              | Permission        | Body / answer                                                       |
| -------------------------------------------- | ----------------- | ------------------------------------------------------------------- |
| `GET /instagram/account`                     | `settings:read`   | `{ connected, username, tokenHint, lastSyncedAt, lastError, ... }`  |
| `PUT /instagram/account`                     | `settings:update` | `{ accessToken }`, checked with Instagram; 422 with why if it isn't |
| `DELETE /instagram/account`                  | `settings:update` | 204; the token and every copied post are deleted                    |
| `POST /instagram/sync`                       | `settings:update` | The account, after checking for new posts                           |
| `GET /instagram/posts`                       | `settings:read`   | `{ posts }` for the admin, pictures at the API's address            |
| `PATCH /instagram/posts/:id`                 | `settings:update` | `{ altText }` → 204                                                 |
| `GET /delivery/add-ons/instagram/posts`      | public            | `?limit=` → `{ username, posts: [{ id, image, alt, permalink }] }`  |
| `GET /delivery/add-ons/instagram/images/:id` | public            | The picture, cached for a year                                      |

The website answers the two public ones at `/_lintel/api/addons/instagram/...`.

## Building and testing

```bash
pnpm --filter @lintel/addon-instagram build        # dist/server.js and dist/admin.js
pnpm --filter @lintel/addon-instagram test         # on a real Lintel, Instagram played by a fake fetch
pnpm --filter @lintel/addon-instagram db:generate --name <what_changed>   # after changing the tables
```

## Files

| File                                 | What it does                                                 |
| ------------------------------------ | ------------------------------------------------------------ |
| `src/server/index.ts`                | The server half: `definePlugin`, its Liquid tag and its jobs |
| `src/server/instagram-api.ts`        | Talking to Instagram, with refusals in plain words           |
| `src/server/instagram.service.ts`    | Connecting, copying posts, renewing the token                |
| `src/server/instagram.routes.ts`     | The endpoints                                                |
| `src/server/instagram.repository.ts` | Database reads and writes                                    |
| `src/server/instagram.table.ts`      | The `instagram_account` and `instagram_posts` tables         |
| `src/server/instagram.schema.ts`     | Settings, requests and answers                               |
| `src/server/instagram.errors.ts`     | Named errors                                                 |
| `src/server/instagram-feed.ts`       | The builder element and the grid the Liquid tag draws        |
| `src/server/instagram.test.ts`       | Tests                                                        |
| `migrations/`                        | The tables' migrations, applied when Lintel starts           |
| `src/admin/index.tsx`                | The admin half: `defineAdminPlugin`                          |
| `src/admin/InstagramPage.tsx`        | The Instagram screen                                         |
| `src/admin/ConnectInstagram.tsx`     | Connecting: the steps and the token                          |
| `src/admin/ConnectedAccount.tsx`     | Connected: the account, checking now, disconnecting          |
| `src/admin/PostGrid.tsx`             | The copied posts                                             |
| `src/admin/AltTextDialog.tsx`        | Describing a post's picture                                  |
| `src/admin/instagram.api.ts`         | Calls to the add-on's routes                                 |
| `src/admin/strings.ts`               | Its words                                                    |

## Databases

It runs on the built-in database, Postgres, MySQL and MariaDB. After changing a table, run
`pnpm db:generate --name <what_changed>` and then `pnpm db:generate:mysql --name <what_changed>`.
Its queries get their tables through `tableFor`, and `lintel addons check` reads them for
anything only Postgres has. `pnpm test:addons` in `packages/core` runs its tests on real servers.
