import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { contentDisposition } from "../media/content-disposition.js";
import { parseRequest } from "../http/http-errors.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { describePersonalDataMap } from "./personal-data-map.service.js";
import type { PrivacyContext } from "./personal-data-sources.js";
import {
  erasePerson,
  exportPerson,
  findPerson,
  listRecentRequests,
} from "./person-requests.service.js";
import { describePolicyHelper } from "./policy-helper.service.js";
import {
  personRequestSchema,
  updateProcessorsRequestSchema,
  updateRetentionRequestSchema,
} from "./privacy.schema.js";
import { describeProcessors, saveAddedProcessors } from "./processors.service.js";
import { describeRetention, updateRetentionRules } from "./retention.service.js";
import { findSiteServices } from "./site-services.service.js";

/**
 * HTTP only. Everything needs `privacy:manage` (Owners and Admins):
 *
 *   GET  /privacy/map                where personal data lives       -> { kinds }
 *   POST /privacy/people/find        { email?, name? }               -> { found, notSearched }
 *   POST /privacy/people/export      { email?, name? }               -> a .zip (JSON and CSVs)
 *   POST /privacy/people/erase       { email?, name? }               -> { parts }
 *   GET  /privacy/requests           exports and erasures made       -> { requests }
 *   GET  /privacy/retention          the rules and what's due        -> { rules }
 *   PUT  /privacy/retention          any rules                       -> the same
 *   GET  /privacy/policy             a draft, and the privacy page check
 *   GET  /privacy/processors         companies found, and added      -> { detected, added }
 *   PUT  /privacy/processors         { processors }                  -> the same
 *
 * People are looked up with POST so their email never ends up in an address or a log.
 */
export async function privacyRoutes(server: FastifyInstance) {
  const manage = { preHandler: requirePermission("privacy:manage") };

  const context = async (): Promise<PrivacyContext> => ({
    database: server.database,
    enabledPlugins: await findEnabledPluginIds(server.database),
    plugins: server.plugins.plugins,
    addons: server.addons.loaded,
    forms: server.forms.context,
  });

  const siteServices = async (request: FastifyRequest) =>
    findSiteServices({
      database: server.database,
      site: await resolveEditingSite(request),
      plugins: server.plugins.plugins,
      shop: server.shop,
      email: server.email,
    });

  server.get("/privacy/map", manage, async () => describePersonalDataMap(await context()));

  server.post("/privacy/people/find", manage, async (request) =>
    findPerson(await context(), parseRequest(personRequestSchema, request.body)),
  );

  server.post("/privacy/people/export", manage, async (request, reply) => {
    const person = parseRequest(personRequestSchema, request.body);
    const { archive, filename } = await exportPerson(await context(), person, getSignedIn(request));
    return reply
      .type("application/zip")
      .header("content-disposition", contentDisposition("attachment", filename))
      .header("cache-control", "no-store")
      .send(archive);
  });

  server.post("/privacy/people/erase", manage, async (request) =>
    erasePerson(
      await context(),
      parseRequest(personRequestSchema, request.body),
      getSignedIn(request),
    ),
  );

  server.get("/privacy/requests", manage, async () => ({
    requests: await listRecentRequests({ database: server.database }),
  }));

  server.get("/privacy/retention", manage, async () => describeRetention(server.database));

  server.put("/privacy/retention", manage, async (request) => {
    await updateRetentionRules(
      server.database,
      parseRequest(updateRetentionRequestSchema, request.body),
    );
    return describeRetention(server.database);
  });

  server.get("/privacy/policy", manage, async (request) =>
    describePolicyHelper(server.database, await siteServices(request)),
  );

  server.get("/privacy/processors", manage, async (request) =>
    describeProcessors(server.database, await siteServices(request)),
  );

  server.put("/privacy/processors", manage, async (request) => {
    const { processors } = parseRequest(updateProcessorsRequestSchema, request.body);
    await saveAddedProcessors(server.database, processors);
    return describeProcessors(server.database, await siteServices(request));
  });
}
