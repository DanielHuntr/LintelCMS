---
title: Troubleshooting
description: The messages you might see, and what to do about each.
since: "0.1"
---

## "Lintel can't reach its server"

The admin runs in your browser but talks to Lintel's server. If you run Lintel yourself,
check that the terminal running `pnpm dev` is still open, then press **Try again**.
Otherwise, check your internet connection or ask whoever looks after your site.

## "You've been signed out"

Sign in again. This happens after a password reset, or if your session has ended.

## "You don't have permission to do this"

Your account isn't allowed to do that. Ask an administrator if you need it.

## My change isn't on the website

- Did you publish it? Saving keeps changes in the admin until you press **Publish** or
  **Publish changes**. See [Publishing](/using/publishing/).
- Websites keep a copy of what they read for a minute or so. Wait a moment and reload.
- Scheduled entries go live within a minute of their time, and only while Lintel is running.

## A file won't upload

- **Larger than 25 MB:** save a smaller or compressed version and try again.
- **Isn't a kind of file Lintel accepts:** see the list in [Media](/using/media/#uploading).
  Lintel checks what a file really is, so renaming it won't help.
- **An SVG is refused:** it contains scripts or other active content. Export it again as a
  plain SVG from your design app.

## "This file is still in use"

A page or post still uses the file. Lintel lists which; open each one, remove or replace
the image, then delete the file.

## A field says it needs attention

When you publish, Lintel checks every field and moves you to the first one with a problem.
The message under it says what to change, such as "Title is required".

## Forgotten password

See [People and permissions](/using/users/#forgotten-password).
