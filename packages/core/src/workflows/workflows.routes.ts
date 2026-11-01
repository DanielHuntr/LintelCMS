import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { parseRequest } from "../http/http-errors.js";
import {
  cancelRun,
  findRunDetail,
  listRuns,
  startRunByHand,
} from "./engine/workflow-runs.service.js";
import { listRoles } from "./workflow-people.repository.js";
import { WorkflowNotFoundError, WorkflowRunNotFoundError } from "./workflows.errors.js";
import {
  createWorkflowRequestSchema,
  listRunsQuerySchema,
  runIdParamsSchema,
  runWorkflowRequestSchema,
  updateWorkflowRequestSchema,
  workflowIdParamsSchema,
} from "./workflows.schema.js";
import {
  createWorkflow,
  deleteWorkflow,
  findWorkflow,
  listWorkflows,
  updateWorkflow,
} from "./workflows.service.js";

/**
 * HTTP only:
 *
 *   GET    /workflows                     (automations:read)
 *   GET    /workflows/catalogue           (automations:read)    events that can start one, and roles
 *   POST   /workflows                     (automations:update)  { name, description?, enabled?, trigger, steps } -> 201
 *   GET    /workflows/:id                 (automations:read)
 *   PATCH  /workflows/:id                 (automations:update)  any of the above
 *   DELETE /workflows/:id                 (automations:update)  -> 204
 *   POST   /workflows/:id/run             (automations:update)  { test?, sampleData?, data?, idempotencyKey? } -> 202
 *   GET    /workflows/:id/runs            (automations:read)    ?page&perPage
 *   GET    /workflow-runs/:runId          (automations:read)    the run with its step log
 *   POST   /workflow-runs/:runId/cancel   (automations:update)
 */
export async function workflowsRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("automations:read") };
  const update = { preHandler: requirePermission("automations:update") };

  server.get("/workflows", read, async () => listWorkflows(server.database));

  server.get("/workflows/catalogue", read, async () => ({
    events: server.events.listDefinitions(),
    roles: await listRoles(server.database, DEFAULT_TENANT_ID),
  }));

  server.post("/workflows", update, async (request, reply) => {
    const workflow = parseRequest(createWorkflowRequestSchema, request.body);
    const created = await createWorkflow(server.database, workflow, getSignedIn(request).user.id);
    return reply.code(201).send(created);
  });

  server.get("/workflows/:id", read, async (request) =>
    findWorkflow(server.database, readWorkflowId(request.params)),
  );

  server.patch("/workflows/:id", update, async (request) => {
    const changes = parseRequest(updateWorkflowRequestSchema, request.body);
    return updateWorkflow(server.database, readWorkflowId(request.params), changes);
  });

  server.delete("/workflows/:id", update, async (request, reply) => {
    await deleteWorkflow(server.database, readWorkflowId(request.params));
    return reply.code(204).send();
  });

  server.post("/workflows/:id/run", update, async (request, reply) => {
    const body = parseRequest(runWorkflowRequestSchema, request.body ?? {});
    const run = await startRunByHand(
      server.database,
      server.events,
      readWorkflowId(request.params),
      body,
      getSignedIn(request),
    );
    server.workflows.runSoon();
    return reply.code(202).send(run);
  });

  server.get("/workflows/:id/runs", read, async (request) => {
    const page = parseRequest(listRunsQuerySchema, request.query);
    return listRuns(server.database, readWorkflowId(request.params), page);
  });

  server.get("/workflow-runs/:runId", read, async (request) =>
    findRunDetail(server.database, readRunId(request.params)),
  );

  server.post("/workflow-runs/:runId/cancel", update, async (request) =>
    cancelRun(server.database, readRunId(request.params)),
  );
}

function readWorkflowId(params: unknown): string {
  const parsed = workflowIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new WorkflowNotFoundError();
  }
  return parsed.data.id;
}

function readRunId(params: unknown): string {
  const parsed = runIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new WorkflowRunNotFoundError();
  }
  return parsed.data.runId;
}
