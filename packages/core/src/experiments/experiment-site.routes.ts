import type { FastifyInstance } from "fastify";
import type { DatabaseOrTransaction } from "../database/client.js";
import { countFromBrowser } from "./experiment-counting.service.js";
import type { ExperimentMeasurement } from "./experiment-measurement.js";
import { countRequestSchema } from "./experiments.schema.js";
import { TESTS_ENDPOINT } from "./tests-script.js";
import { readVisitor } from "./visitor-assignment.js";

/**
 * HTTP only, on the website's own server:
 *
 *   POST /_lintel/tests  { experiment, version, event: "visit" | "conversion" }  -> 204
 *
 * What a tested page's script reports (see tests-script.ts). Sent with `sendBeacon`, so the
 * body comes as text. The answer is always 204, counted or not, so it says nothing about
 * which tests exist.
 */
export async function experimentSiteRoutes(
  server: FastifyInstance,
  options: {
    database: () => DatabaseOrTransaction;
    measurement: () => ExperimentMeasurement;
  },
) {
  server.post(TESTS_ENDPOINT, { bodyLimit: 1024 }, async (request, reply) => {
    const parsed = countRequestSchema.safeParse(readBody(request.body));
    if (parsed.success) {
      await countFromBrowser(
        options.database(),
        options.measurement(),
        parsed.data,
        readVisitor(request.headers, request.ip),
      );
    }
    return reply.code(204).header("cache-control", "no-store").send();
  });
}

function readBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
