# 43. Page drafting runs an open writing model on the site's own server

Date: 2026-11-03

## Decision

The optional **Page drafting** plugin (id `drafts`) drafts a page from a short description
("Draft a page for me" in the builder) and rewrites a heading or paragraph ("Rewrite this":
shorter, friendlier, more formal). It is off by default. Everything runs on the server Lintel
runs on: no other service is asked anything while it works, and nothing about the site leaves
the server, then or later.

- **The model:** Qwen2.5 7B Instruct, quantised to 4 bits (Q4_K_M), from its makers' own
  repository, pinned to one revision. Apache License 2.0.
- **The runner:** llama.cpp, inside the Lintel process, through `node-llama-cpp` 3.22.2 (MIT).
- **Downloaded only when an admin asks**, after the setup screen (Settings → Page drafting)
  has shown the model's name, maker, licence, size, the exact addresses it downloads from,
  the folder it is saved in and the memory it needs. The admin can instead copy the files in
  by hand; the screen shows the folder and file names, then checks them.
- **Every file is checked against its published SHA-256** (below) before it is used. A file
  that doesn't match is deleted and refused, downloaded or copied in.
- **The answer's shape is enforced, not asked for.** The model writes under a grammar made
  from a JSON schema (llama.cpp's grammar-constrained sampling), so it can only produce a plan
  made of Lintel's own section kinds, with the chosen sections in the chosen order. The plan
  is checked again with Zod and turned into sections by the section library's own builders
  (`@lintel/builder-model`, `page-drafts/`), so drafted sections are ordinary, editable
  sections styled by the site's theme tokens and styles.
- **Never published by it.** Drafted sections are added to the page being edited as one
  change (one Undo). The form says the words need checking before publishing.

## The model, exactly

Read from https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF at revision
`bb5d59e06d9551d752d08b292a50eb208b07ab1f` (the repository's model card says
`license: apache-2.0` and its LICENSE file is the Apache License 2.0).

| File                                             | Bytes         | SHA-256                                                            |
| ------------------------------------------------ | ------------- | ------------------------------------------------------------------ |
| `qwen2.5-7b-instruct-q4_k_m-00001-of-00002.gguf` | 3,993,201,344 | `dfce12e3862a5283ccfb88221b48480e58745165de856439950d0f22590580db` |
| `qwen2.5-7b-instruct-q4_k_m-00002-of-00002.gguf` | 689,872,288   | `539cf93f78e887edea1c04e2d7d8cdaca9d01dae9c9025bcb8accbe29df3d72a` |

4,683,073,632 bytes in all (4.4 GB). Each downloads from
`https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/<revision>/<file>`, which
Hugging Face answers with a redirect to its own download network. The makers publish this
quantisation in two files; llama.cpp reads them as one model when given the first. The
files go in `<Lintel folder>/models/qwen2.5-7b-instruct-q4_k_m/`.

Why this one: it is instruction-tuned, good at following a JSON shape, about 7B parameters
(the largest size that still drafts a page in a minute or two on an ordinary server's
processor), Apache 2.0, and its makers publish the quantised file themselves, so there is no
third party between them and the site. Mistral 7B Instruct v0.3 (also Apache 2.0) was the
other candidate, but Mistral publishes no GGUF file of its own; it would have meant trusting
a community conversion.

## What downloads when, and what never does

- **When Lintel is installed:** `node-llama-cpp` and its prebuilt llama.cpp for the machine
  (`@node-llama-cpp/<platform>`, from the npm registry like any other package, about 33 MB on
  x64, plus the Vulkan build where there is one). The CUDA builds (180 to 390 MB each) are
  left out of every install by an override in `pnpm-workspace.yaml`; drafting runs on the
  processor. `node-llama-cpp`'s own install script (which could build llama.cpp from source)
  doesn't run, because pnpm only runs the build scripts the workspace lists, and it isn't
  listed.
- **When an admin presses Download:** the two model files, from the addresses above.
- **Never while Lintel runs:** `getLlama({ build: "never" })` uses the prebuilt llama.cpp and
  never downloads or compiles anything. `node-llama-cpp` is imported only when the first
  draft is asked for, so a server that never drafts never loads it. Its log is kept to
  errors, which never contain prompts or answers.

## Limits and safety

- **One draft at a time per server**, because the model takes most of the processor and
  several gigabytes of memory while it writes. A second asks to try again in a minute.
- **A time limit** of five minutes per draft, and **Stop** at any time.
- **A memory check:** about 6 GB must be free before the model is loaded (it stays loaded
  for five idle minutes, then is freed). The setup screen warns when the server has less than
  that in all, and refuses to download when the disk is too small.
- **Permission `drafts:use`**, held by the built-in Editor and Admin roles (and Owner), not
  Author or Viewer. Drafting only adds editable sections to a page someone could already edit,
  so editors, who write and publish content, are the natural owners; authors can be given it
  in a custom role. Setting the model up needs `settings:update`; seeing it, `settings:read`.
- **Words stay on the server.** Prompts and answers are kept in memory only, for the person
  who asked, for ten minutes; nothing is written to the database or logged.
- **No invented facts.** The model is told never to invent names, prices, phone numbers,
  addresses or numbers, and to write placeholders such as `[price]` instead. Buttons link to
  `#` until someone chooses a page, and example quotes are signed "Customer name".

## Consequences

- The model's files belong to the server, not one site: on a multisite install, removing it
  removes it for every site. Each site still switches the plugin on for itself.
- Drafting needs a server with about 8 GB of memory or more; smaller servers are told so
  plainly. There is no hosted fallback, by design.
- A newer model means a new entry in `writing-model.ts` with its own checksums, and a new
  decision record.
