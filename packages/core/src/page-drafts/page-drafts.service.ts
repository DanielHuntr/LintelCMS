import {
  type DraftPlan,
  type DraftSectionKind,
  draftPlanJsonSchema,
  readDraftPlan,
  rewriteJsonSchema,
  rewriteSchema,
} from "@lintel/builder-model";
import {
  pageDraftInstructions,
  pageDraftPrompt,
  rewriteInstructions,
  rewritePrompt,
} from "./draft-prompts.js";
import { DraftProblem, type DraftJob, type DraftingDesk } from "./drafting-desk.js";
import type { ModelRunner } from "./model-runner.js";
import type { ModelSetup } from "./model-setup.service.js";
import { ModelNotInstalledError, NotEnoughMemoryError } from "./page-drafts.errors.js";
import type { DraftPageRequest, RewriteRequest } from "./page-drafts.schema.js";

export type DraftResult = { plan: DraftPlan } | { text: string };

export interface PageDraftsContext {
  setup: ModelSetup;
  runner: ModelRunner;
  desk: DraftingDesk<DraftResult>;
  /** Free memory now; the real figure unless a test says otherwise. */
  freeMemoryInBytes: () => number;
}

/** About how long each kind of answer is, for the progress bar. */
const CHARACTERS_PER_SECTION = 520;
const SECTIONS_WHEN_MODEL_CHOOSES = 5;
/** Enough tokens for seven full sections; the schema's lengths keep it well inside. */
const MOST_PAGE_TOKENS = 3000;
const MOST_REWRITE_TOKENS = 500;

/** Whether drafting can start: the model is installed. For the builder's buttons. */
export async function readDraftingStatus(context: PageDraftsContext) {
  return { ready: await context.setup.files.isInstalled(), busy: context.desk.isBusy };
}

export async function startPageDraft(
  context: PageDraftsContext,
  request: DraftPageRequest,
  siteName: string | null,
  userId: string,
): Promise<DraftJob<DraftResult>> {
  await checkReady(context);
  const kinds = request.sections as DraftSectionKind[];
  return context.desk.start({
    userId,
    expectedCharacters:
      CHARACTERS_PER_SECTION * (kinds.length > 0 ? kinds.length : SECTIONS_WHEN_MODEL_CHOOSES),
    run: async (signal, onProgress) => {
      const answer = await context.runner.write(context.setup.files.modelPath, {
        instructions: pageDraftInstructions(),
        prompt: pageDraftPrompt(request, siteName),
        jsonSchema: draftPlanJsonSchema(kinds),
        maxTokens: MOST_PAGE_TOKENS,
        signal,
        onProgress,
      });
      const plan = readDraftPlan(parseJson(answer));
      if (!plan) throw new DraftProblem("The draft came out incomplete. Try again.");
      return { plan };
    },
  });
}

export async function startRewrite(
  context: PageDraftsContext,
  request: RewriteRequest,
  userId: string,
): Promise<DraftJob<DraftResult>> {
  await checkReady(context);
  return context.desk.start({
    userId,
    expectedCharacters: request.text.length + 12,
    run: async (signal, onProgress) => {
      const answer = await context.runner.write(context.setup.files.modelPath, {
        instructions: rewriteInstructions(),
        prompt: rewritePrompt(request),
        jsonSchema: rewriteJsonSchema,
        maxTokens: MOST_REWRITE_TOKENS,
        signal,
        onProgress,
      });
      const parsed = rewriteSchema.safeParse(parseJson(answer));
      if (!parsed.success) throw new DraftProblem("The rewrite came out empty. Try again.");
      return { text: parsed.data.text };
    },
  });
}

/** The model is installed, and (unless it's already in memory) there's room to load it. */
async function checkReady(context: PageDraftsContext): Promise<void> {
  if (!(await context.setup.files.isInstalled())) throw new ModelNotInstalledError();
  const needed = context.setup.files.model.memoryNeededInBytes;
  const free = context.freeMemoryInBytes();
  if (!context.runner.isLoaded() && free < needed) throw new NotEnoughMemoryError(needed, free);
}

function parseJson(answer: string): unknown {
  try {
    return JSON.parse(answer);
  } catch {
    return null;
  }
}
