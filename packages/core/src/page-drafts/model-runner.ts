import type { JsonSchema } from "@lintel/builder-model";

/** What the writing model is asked: who it is, what to write, and the shape to write it in. */
export interface WritingRequest {
  instructions: string;
  prompt: string;
  /** The model can only write JSON that fits this (llama.cpp turns it into a grammar). */
  jsonSchema: JsonSchema;
  maxTokens: number;
  signal: AbortSignal;
  /** How many characters it has written so far, for the progress bar. */
  onProgress: (characters: number) => void;
}

/**
 * Runs the writing model. The real one is llama.cpp on this server (llama-model-runner.ts);
 * tests use a stand-in, so they never need the 4.7 GB model.
 */
export interface ModelRunner {
  /** Resolves with the JSON text the model wrote. */
  write(modelPath: string, request: WritingRequest): Promise<string>;
  /** Whether the model is in memory now (so the memory check can allow for it). */
  isLoaded(): boolean;
  /** Frees the model's memory. */
  unload(): Promise<void>;
}
