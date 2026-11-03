import type { FastifyInstance } from "fastify";
import { builtInMeasurement, type ExperimentMeasurement } from "./experiment-measurement.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What A/B tests need besides the request (see src/experiments). */
    experiments: ExperimentsRuntime;
  }
}

export interface ExperimentsRuntime {
  /** Where visitors and conversions are counted and read back. */
  measurement: ExperimentMeasurement;
}

export interface ExperimentsOptions {
  /**
   * Counts from somewhere else, such as first-party analytics. The built-in counts by default.
   * See docs/decisions/0044-ab-testing.md.
   */
  measurement?: ExperimentMeasurement;
}

/** Everything A/B tests add to the server besides their routes (see experiments.plugin.ts). */
export function registerExperiments(server: FastifyInstance, options: ExperimentsOptions = {}) {
  server.decorate("experiments", { measurement: options.measurement ?? builtInMeasurement });
}
