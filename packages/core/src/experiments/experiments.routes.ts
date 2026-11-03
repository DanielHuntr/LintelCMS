import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { actorOf } from "../events/event-actor.js";
import { changeContext } from "../entries/entries.routes.js";
import { parseRequest } from "../http/http-errors.js";
import { hasPermission } from "../roles/permissions.js";
import { endExperiment, readResults } from "./experiment-results.service.js";
import { MayNotPublishError } from "./experiments.errors.js";
import {
  addVersionRequestSchema,
  chooseWinnerRequestSchema,
  createExperimentRequestSchema,
  entryIdParamsSchema,
  experimentIdParamsSchema,
  saveVersionRequestSchema,
  updateExperimentRequestSchema,
  versionParamsSchema,
} from "./experiments.schema.js";
import {
  addVersion,
  createExperiment,
  deleteExperiment,
  findExperiment,
  findOpenExperimentForEntry,
  listExperiments,
  removeVersion,
  saveVersion,
  startExperiment,
  stopExperiment,
  updateExperiment,
} from "./experiments.service.js";

/**
 * HTTP only. Everything needs `experiments:manage`:
 *
 *   GET    /experiments                        -> { experiments: [Experiment] }
 *   POST   /experiments                        { entryId, sectionId? } -> 201 Experiment (with B)
 *   GET    /experiments/for-page/:entryId      -> { experiment: Experiment | null }
 *   GET    /experiments/:id                    -> Experiment
 *   PATCH  /experiments/:id                    { goal?, split? } -> Experiment
 *   DELETE /experiments/:id                    -> 204
 *   POST   /experiments/:id/versions           { from? } -> Experiment (with C)
 *   PUT    /experiments/:id/versions/:version  { design } -> Experiment
 *   DELETE /experiments/:id/versions/:version  -> { experiment: Experiment | null }
 *   POST   /experiments/:id/start              -> Experiment
 *   POST   /experiments/:id/stop               -> Experiment
 *   GET    /experiments/:id/results            -> Results
 *   POST   /experiments/:id/end                { version } -> Experiment; publishes B or C,
 *                                              which also needs `entries:publish`
 */
export async function experimentsRoutes(server: FastifyInstance) {
  const manage = { preHandler: requirePermission("experiments:manage") };
  const readId = (params: unknown) => parseRequest(experimentIdParamsSchema, params).id;

  server.get("/experiments", manage, async () => listExperiments(server.database));

  server.post("/experiments", manage, async (request, reply) => {
    const body = parseRequest(createExperimentRequestSchema, request.body);
    return reply.code(201).send(await createExperiment(server.database, body));
  });

  server.get("/experiments/for-page/:entryId", manage, async (request) => {
    const { entryId } = parseRequest(entryIdParamsSchema, request.params);
    return { experiment: await findOpenExperimentForEntry(server.database, entryId) };
  });

  server.get("/experiments/:id", manage, async (request) =>
    findExperiment(server.database, readId(request.params)),
  );

  server.patch("/experiments/:id", manage, async (request) =>
    updateExperiment(
      server.database,
      readId(request.params),
      parseRequest(updateExperimentRequestSchema, request.body ?? {}),
    ),
  );

  server.delete("/experiments/:id", manage, async (request, reply) => {
    await deleteExperiment(server.database, readId(request.params));
    return reply.code(204).send();
  });

  server.post("/experiments/:id/versions", manage, async (request) => {
    const { from } = parseRequest(addVersionRequestSchema, request.body ?? {});
    return addVersion(server.database, readId(request.params), from);
  });

  server.put("/experiments/:id/versions/:version", manage, async (request) => {
    const { id, version } = parseRequest(versionParamsSchema, request.params);
    const { design } = parseRequest(saveVersionRequestSchema, request.body);
    return saveVersion(server.database, id, version, design, getSignedIn(request).permissions);
  });

  server.delete("/experiments/:id/versions/:version", manage, async (request) => {
    const { id, version } = parseRequest(versionParamsSchema, request.params);
    return { experiment: await removeVersion(server.database, id, version) };
  });

  server.post("/experiments/:id/start", manage, async (request) =>
    startExperiment(server.database, readId(request.params)),
  );

  server.post("/experiments/:id/stop", manage, async (request) =>
    stopExperiment(server.database, readId(request.params)),
  );

  server.get("/experiments/:id/results", manage, async (request) =>
    readResults(server.database, server.experiments.measurement, readId(request.params)),
  );

  server.post("/experiments/:id/end", manage, async (request) => {
    const id = readId(request.params);
    const { version } = parseRequest(chooseWinnerRequestSchema, request.body);
    const permissions = getSignedIn(request).permissions;
    if (version !== "original" && !hasPermission(permissions, "entries:publish")) {
      throw new MayNotPublishError();
    }
    const ended = await endExperiment(server.database, id, version, changeContext(request));
    if (ended.published) {
      const entry = await describeEntryForEvent(server.database, ended.experiment.entryId);
      await announceContentEvent(server, { name: "entry.published", entry }, actorOf(request));
    }
    return ended.experiment;
  });
}
