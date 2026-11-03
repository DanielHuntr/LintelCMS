# Page drafting

An optional plugin (id `drafts`), off until someone switches it on in Build → Features. A
writing model running on this server drafts a page from a short description, or rewrites a
heading or paragraph. Nothing is sent to another service while it works. Why it works this
way, and the model's exact files and checksums: `docs/decisions/0043-page-drafting.md`.

## How it works

1. **Setting up** (Settings → Page drafting, `settings:update`). `GET /drafts/model` says what
   the model is, where it downloads from and where it goes, before anything happens.
   `POST /drafts/model/download` downloads it in the background (`model-download.ts`):
   resumed with Range requests, each file checked against its SHA-256, refused and deleted
   if wrong. Or the admin copies the files in and `POST /drafts/model/check` checks them.
2. **Drafting** (`drafts:use`). `POST /drafts/page` starts a draft and answers 202 with a job.
   The model writes under a grammar made from `draftPlanJsonSchema` (in
   `@lintel/builder-model`), so its answer is always a plan of Lintel's own sections; the
   plan is checked again with `readDraftPlan`. The builder asks `GET /drafts/jobs/:id` each
   second and turns the plan into sections with `sectionsFromDraftPlan`.
3. **Rewriting**: `POST /drafts/rewrite { text, style }`, the same way, answering `{ text }`.

## Limits

One draft at a time per server (`drafting-desk.ts`), a five-minute time limit, Stop, about
6 GB of free memory before the model loads, and drafts kept in memory for ten minutes for
the person who asked only. Prompts and answers are never logged or stored.

## Endpoints

| Method and path                      | Permission        | Success                                                                       |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------------------- |
| `GET /drafts/model`                  | `settings:read`   | 200 the model, its state, this server's room                                  |
| `POST /drafts/model/download`        | `settings:update` | 202 status (507 `NOT_ENOUGH_DISK`, 409 busy)                                  |
| `POST /drafts/model/download/cancel` | `settings:update` | 200 status; what arrived is kept                                              |
| `POST /drafts/model/check`           | `settings:update` | 202 status                                                                    |
| `DELETE /drafts/model`               | `settings:update` | 200 status                                                                    |
| `GET /drafts/status`                 | `drafts:use`      | 200 `{ ready, busy }`                                                         |
| `POST /drafts/page`                  | `drafts:use`      | 202 job (409 `MODEL_NOT_INSTALLED`, `DRAFTING_BUSY`; 503 `NOT_ENOUGH_MEMORY`) |
| `POST /drafts/rewrite`               | `drafts:use`      | 202 job                                                                       |
| `GET /drafts/jobs/:jobId`            | `drafts:use`      | 200 `{ id, state, characters, expectedCharacters, result, problem }`          |
| `POST /drafts/jobs/:jobId/stop`      | `drafts:use`      | 200 job                                                                       |

## Files

| File                        | What it does                                                   |
| --------------------------- | -------------------------------------------------------------- |
| `page-drafts.plugin.ts`     | The plugin definition and its `drafts:use` permission          |
| `register-page-drafts.ts`   | What the routes need; options for tests                        |
| `page-drafts.routes.ts`     | HTTP only                                                      |
| `page-drafts.service.ts`    | Starting drafts and rewrites, the readiness and memory checks  |
| `model-setup.service.ts`    | Download, check, cancel and remove, in the background          |
| `model-download.ts`         | Resumable download with SHA-256 checks                         |
| `model-files.repository.ts` | The model's files on disk                                      |
| `writing-model.ts`          | The model: name, licence, addresses, sizes and checksums       |
| `model-runner.ts`           | What a model runner does                                       |
| `llama-model-runner.ts`     | The real one: llama.cpp through node-llama-cpp, loaded lazily  |
| `drafting-desk.ts`          | One draft at a time, time limit, Stop, results for their owner |
| `draft-prompts.ts`          | What the model is told                                         |
| `page-drafts.schema.ts`     | Zod schemas for requests                                       |
| `page-drafts.errors.ts`     | Named errors                                                   |
| `page-drafts.test.ts`       | Tests with a stand-in repository and a stand-in model          |

`buildServer({ pageDrafts: { modelsFolder, model, runner, ... } })` points it at stand-ins
for tests, so tests never download or run the real model.
