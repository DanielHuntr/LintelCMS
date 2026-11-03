---
title: Page drafting
description: Drafting a page from a short description, and rewriting a heading or paragraph, with a writing model that runs on your own server.
since: "1.0.0-rc"
sidebar:
  label: Page drafting
---

Page drafting writes a first draft of a page from a short description: "A page for our
Saturday baking classes, for beginners". It adds ordinary sections to your page, in your
site's colours and fonts, which you then change like anything else. It can also rewrite a
heading or paragraph: shorter, friendlier or more formal.

It all runs on the server Lintel runs on. Nothing about your site, and nothing you type, is
sent to anyone, then or later. Once it's set up, it works offline.

## Switching it on

Page drafting is off until you switch it on:

1. Go to **Build**, then **Features**, and switch on **Page drafting**.
2. Go to **Settings**, then **Page drafting**, to set up the writing model (below).

It needs a server with about 8 GB of memory or more. The setup screen says plainly if
yours is too small.

## Setting up the writing model

Before anything downloads, **Settings → Page drafting** shows exactly what you'll get:

| Shown              | What it is                                                         |
| ------------------ | ------------------------------------------------------------------ |
| **Model**          | Qwen2.5 7B Instruct, a writing model released openly by its makers |
| **Made by**        | The Qwen team at Alibaba Cloud                                     |
| **Licence**        | Apache License 2.0, linked                                         |
| **Size**           | 4.4 GB, in two files                                               |
| **Downloads from** | The makers' own page on Hugging Face, pinned to one exact version  |
| **Saved to**       | A `models` folder inside Lintel's own folder on your server        |
| **Memory needed**  | About 6 GB free while it writes                                    |

Then choose one:

- **Download 4.4 GB.** A progress bar shows how far it's got. **Cancel download** keeps what
  has arrived, and **Resume download** carries on from there.
- **I'll copy the file in myself.** The screen lists the folder and the file names. Put the
  files there (from a USB stick, say), then press **Check files**.

Either way, Lintel checks every file against the checksum its makers published. A file that
doesn't match is deleted and refused. When it's ready, the screen says **Installed and
checked**. **Remove** deletes the model again.

Setting the model up needs permission to change settings. On a Lintel with several sites,
the model belongs to the server: every site can use it once it switches page drafting on,
and removing it removes it for all of them.

### What downloads, and from where

- **When Lintel is installed:** the small program that runs the model (about 33 MB), from
  the same package registry as the rest of Lintel.
- **When you press Download:** the two model files, from `huggingface.co`, the makers'
  own page, which hands the download to Hugging Face's own download network.
- **Never while Lintel runs:** nothing else is downloaded or sent anywhere. What you type
  and what the model writes stay in the server's memory for ten minutes, for the person who
  asked, and are never saved or logged.

## Drafting a page

1. Open a page in the page builder. An empty page offers **Draft a page for me**; on any
   page, it's at the top of **Insert → Sections**.
2. Fill in the short form:
   - **What is this page for?**
   - **Who is it for?**
   - **Tone**: Friendly, Professional, Playful or Calm.
   - **Sections**: tick the ones you want, such as Welcome, What you offer, About you and
     Call to action. Leave them all off to let the model choose.
3. Press **Draft page**. It says **This can take a minute or two**. A progress bar shows
   while it writes; **Stop** stops it and adds nothing.

The sections are added to your page as one change, so one **Undo** takes them all away.
Nothing is published: read every word and change what's wrong before you press
**Publish**.

The model is told never to make up facts. Where it would need a price, a phone number or an
address, it writes a placeholder such as `[price]` for you to fill in. Buttons link nowhere
until you choose a page, example quotes are signed "Customer name", and pictures are
Lintel's own drawings, ready for your photos.

## Rewriting a heading or paragraph

Select a heading or paragraph and open **Content**. Under the words, **Rewrite this**
offers **Shorter**, **Friendlier** and **More formal**. **Undo** puts the old words back.

## Limits

- One draft at a time on each server, because the model uses most of the processor while it
  writes. Someone else drafting at the same time is asked to try again in a minute.
- A draft stops after five minutes.
- The model stays in memory for five quiet minutes after a draft, then frees it.

## Who can use it

Editors, Admins and Owners can draft and rewrite. Authors and Viewers can't, unless they
are given permission in a role of your own.

## For developers

The model runs inside the Lintel process through `node-llama-cpp`, on the processor. Its
answer is held to the shape of Lintel's own sections by a grammar, checked again, and built
with the section library's builders. The model's exact files, sizes and checksums are in
`docs/decisions/0043-page-drafting.md`.
