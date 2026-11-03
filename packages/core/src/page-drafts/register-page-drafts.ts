import { freemem } from "node:os";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { DraftResult, PageDraftsContext } from "./page-drafts.service.js";
import { DraftingDesk } from "./drafting-desk.js";
import { createLlamaModelRunner } from "./llama-model-runner.js";
import type { Fetch } from "./model-download.js";
import { ModelFiles } from "./model-files.repository.js";
import type { ModelRunner } from "./model-runner.js";
import { ModelSetup } from "./model-setup.service.js";
import { qwenWritingModel, type WritingModel } from "./writing-model.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What the Page drafting plugin's routes need (see src/page-drafts). */
    pageDrafts: PageDraftsContext;
  }
}

/** A draft is stopped after this long, whatever stage it has reached. */
const DEFAULT_TIME_LIMIT_MS = 5 * 60 * 1000;

export interface PageDraftsOptions {
  /** Where models are kept. Defaults to "models" in the Lintel folder, beside the data. */
  modelsFolder?: string;
  /** Tests use a small stand-in model and runner, so nothing large is downloaded or run. */
  model?: WritingModel;
  runner?: ModelRunner;
  fetch?: Fetch;
  freeMemoryInBytes?: () => number;
  totalMemoryInBytes?: () => number;
  timeLimitMs?: number;
}

/**
 * Everything page drafting adds to the server besides its routes (which are the plugin's).
 * Nothing is loaded here: the model runner imports llama.cpp only when the first draft is
 * asked for, and only while the plugin is switched on can anyone ask.
 */
export function registerPageDrafts(server: FastifyInstance, options: PageDraftsOptions = {}) {
  const modelsFolder =
    options.modelsFolder ?? join(dirname(server.lintelFolder.configFile), "models");
  const files = new ModelFiles(modelsFolder, options.model ?? qwenWritingModel);
  const setup = new ModelSetup(files, {
    fetch: options.fetch,
    totalMemoryInBytes: options.totalMemoryInBytes,
  });
  const runner = options.runner ?? createLlamaModelRunner();
  server.decorate("pageDrafts", {
    setup,
    runner,
    desk: new DraftingDesk<DraftResult>(options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS),
    freeMemoryInBytes: options.freeMemoryInBytes ?? freemem,
  });
  server.addHook("onClose", async () => {
    setup.cancel();
    await runner.unload();
  });
}
