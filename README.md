<p align="center">
  <img src="brand/lintel-app-icon.svg" width="88" height="88" alt="" />
</p>

<h1 align="center">Lintel</h1>

A self-hosted CMS with a visual builder, an animation studio and built-in commerce,
written in TypeScript and React.

Lintel is early. Today it has setup in the browser, content types with 17 kinds of field and
a page builder, languages, categories and menus, media, live preview, search, a REST and
GraphQL API, webhooks, SEO tools, documentation and a Next.js starter. Commerce, the
visual builder and the animation studio come next.

## Getting started

You need two things on your computer:

- **Node.js 22 or newer**, from [nodejs.org](https://nodejs.org) (the "LTS" download).
- **pnpm 10**. After installing Node, open a terminal and run `npm install -g pnpm@10.28.0`.

There's nothing else to install: Lintel comes with a built-in database.

In a terminal, download Lintel, install it and start it:

```bash
git clone https://github.com/DanielHuntr/lintelcms.git
cd lintelcms
pnpm install
pnpm dev
```

The first start takes a few seconds while Lintel creates its database. When it's ready
you'll see:

```text
Using the built-in database (stored in .lintel/data). Set DATABASE_URL to use your own Postgres.

Lintel's API is running. Open http://localhost:5173 to finish setting up.

Setup code: 4821-0937 (needed only when setting up from another computer)
```

Open **http://localhost:5173** in your browser. The setup screen walks you through:

1. **Where to keep your content.** Keep the built-in database (the simplest choice, good
   for trying Lintel or for a small site on one computer), or connect your own PostgreSQL
   server by filling in its address, user name and password. Lintel can test the
   connection and create the database for you. Your choice is saved in
   `.lintel/config.json`.
2. **Your account.** Your name, email and a password of at least 12 characters. This
   first account can do everything.
3. **What are you building?** A business site, blog, shop, portfolio or a blank site.
   Lintel switches on only the features that kind of site needs; you can change them later.

To stop Lintel, press `Ctrl+C` in the terminal. Run `pnpm dev` again to start it; your
content is kept.

The setup code is only needed if you open the setup screen from a different computer
than the one Lintel runs on (for example, on a server). It stops strangers from setting
up your site before you do.

### Using your own Postgres

The setup screen is the easiest way to connect your own PostgreSQL server. If you would
rather set it in a file, or you run Lintel on a server, set `DATABASE_URL` instead. It
always wins over the setup screen's choice (and the setup screen then skips that step).

Copy `.env.example` to `.env` and uncomment the `DATABASE_URL` line:

```bash
# macOS and Linux
cp .env.example .env
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```text
DATABASE_URL=postgres://lintel:your-password@localhost:5432/lintel
```

If your password contains `#`, `@` or `/`, write them as `%23`, `%40` and `%2F`. For
example, the password `p@ss#1` is written `p%40ss%231`.

Don't have Postgres but do have Docker? `pnpm db:up` starts one that matches the example
line above, and `pnpm db:down` stops it.

Lintel creates and updates its tables every time it starts. If you'd rather do that as a
separate step (before a deploy, say), run `pnpm db:migrate`.

### If something goes wrong

**"pnpm is not recognized" or "command not found: pnpm"**
Install it with `npm install -g pnpm@10.28.0`, then close the terminal and open a new one.

**Windows: "running scripts is disabled on this system"**
PowerShell blocks the `npm` and `pnpm` commands until you allow scripts for your own account. Run
this once, answer `Y`, then try again:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**"DATABASE_URL isn't a valid Postgres address" or "Postgres turned down the password"**
Your database password probably contains `#`, `@` or `/`. Write them in `DATABASE_URL`
as `%23`, `%40` and `%2F`. (On the setup screen you can type the password as it is.)

**"Lintel can't reach Postgres at localhost:5432. Is it running?"**
Start your Postgres server, or remove the `DATABASE_URL` line from `.env` to use the
built-in database.

**"The built-in database is already in use by another Lintel program"**
Lintel is already running somewhere, probably in another terminal. Stop it with `Ctrl+C`
first.

**"Port 4000 is already in use"**
Another copy of Lintel is running. Stop it, or set `API_PORT=4001` in `.env`.

**Forgot your password?**
Stop Lintel with `Ctrl+C`, then run this and type a new password twice:

```bash
pnpm reset-password --email you@example.com
```

If that email doesn't exist, it tells you the closest one it knows. Resetting also signs
you out everywhere.

**Starting over**
Stop Lintel and delete the `.lintel` folder. That removes the built-in database (all your
content) and the setup screen's choice, so the next `pnpm dev` starts setup from scratch.

### More commands

```bash
pnpm create-admin --email you@example.com --name "Your Name"   # another Super admin
pnpm reset-password --email you@example.com                    # a new password
pnpm db:migrate                                                # update the tables now
```

`create-admin` and `reset-password` ask for the password without showing it. For
scripted setups, set `LINTEL_ADMIN_PASSWORD` or `LINTEL_NEW_PASSWORD` instead.

## What's in here

| Path              | What it is                                                 |
| ----------------- | ---------------------------------------------------------- |
| `packages/core`   | The API server: content model, entries, users, permissions |
| `packages/admin`  | The control panel (React)                                  |
| `packages/docs`   | The documentation site, also the admin's built-in help     |
| `starters/nextjs` | A Next.js website that reads Lintel's delivery API         |
| `docs/decisions`  | Why the big choices were made                              |
| `CONTRIBUTING.md` | How code is written here. Read this first                  |

## Documentation and the Next.js starter

The docs cover using Lintel and building websites with it. Neither of these starts with
`pnpm dev`; run them when you need them:

```bash
pnpm docs:dev                          # the docs, on http://localhost:4321
pnpm --filter starter-nextjs dev       # the starter site, on http://localhost:3000
```

The starter's [README](starters/nextjs/README.md) walks through it step by step.

## Everyday commands

```bash
pnpm test         # all tests (on the built-in database; set TEST_DATABASE_URL for Postgres)
pnpm typecheck    # TypeScript in every package
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # production builds
```

A pre-commit hook runs ESLint and Prettier on the files you change.
