import type * as LlamaModule from "node-llama-cpp";
import type { ModelRunner, WritingRequest } from "./model-runner.js";

/** The model leaves memory after this long without a draft, so an idle server stays light. */
const UNLOAD_AFTER_MS = 5 * 60 * 1000;
/** Enough for the instructions and a seven-section page. */
const CONTEXT_TOKENS = 4096;

type NodeLlamaCpp = typeof LlamaModule;
type Llama = Awaited<ReturnType<NodeLlamaCpp["getLlama"]>>;
type LlamaModel = Awaited<ReturnType<Llama["loadModel"]>>;

/**
 * The writing model, run by llama.cpp inside this server through node-llama-cpp (MIT).
 *
 * - node-llama-cpp is imported only when the first draft is asked for, so a server that
 *   never drafts never loads it.
 * - `build: "never"`: it uses the prebuilt llama.cpp that came with the package and never
 *   downloads or compiles anything while Lintel runs. Nothing is sent anywhere.
 * - llama.cpp's own log is kept to errors, which never contain prompts or answers.
 */
export function createLlamaModelRunner(): ModelRunner {
  let llama: Llama | undefined;
  let loaded: { path: string; model: LlamaModel } | undefined;
  let unloadTimer: NodeJS.Timeout | undefined;

  async function modelAt(path: string): Promise<{ module: NodeLlamaCpp; model: LlamaModel }> {
    const module = await import("node-llama-cpp");
    llama ??= await module.getLlama({
      build: "never",
      progressLogs: false,
      logLevel: module.LlamaLogLevel.error,
      logger: () => {},
    });
    if (loaded?.path !== path) {
      await loaded?.model.dispose();
      loaded = { path, model: await llama.loadModel({ modelPath: path }) };
    }
    return { module, model: loaded.model };
  }

  async function unload() {
    clearTimeout(unloadTimer);
    await loaded?.model.dispose();
    loaded = undefined;
  }

  return {
    isLoaded: () => loaded !== undefined,
    unload,
    async write(modelPath: string, request: WritingRequest): Promise<string> {
      clearTimeout(unloadTimer);
      const { module, model } = await modelAt(modelPath);
      const context = await model.createContext({ contextSize: CONTEXT_TOKENS });
      try {
        const session = new module.LlamaChatSession({
          contextSequence: context.getSequence(),
          systemPrompt: request.instructions,
        });
        const grammar = await (llama as Llama).createGrammarForJsonSchema(
          request.jsonSchema as Parameters<Llama["createGrammarForJsonSchema"]>[0],
        );
        let characters = 0;
        return await session.prompt(request.prompt, {
          grammar,
          maxTokens: request.maxTokens,
          signal: request.signal,
          temperature: 0.7,
          onTextChunk: (chunk) => {
            characters += chunk.length;
            request.onProgress(characters);
          },
        });
      } finally {
        await context.dispose();
        unloadTimer = setTimeout(() => void unload(), UNLOAD_AFTER_MS);
        unloadTimer.unref();
      }
    },
  };
}
