import type { FastifyRequest } from "fastify";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { SeoPluginDisabledError } from "./seo.errors.js";

/** Whether the "SEO tools" plugin is switched on (see src/plugins). */
export async function isSeoPluginEnabled(database: DatabaseOrTransaction): Promise<boolean> {
  return (await findEnabledPluginIds(database)).includes("seo");
}

/** A preHandler: every SEO endpoint answers 404 PLUGIN_NOT_ENABLED while the plugin is off. */
export async function requireSeoPlugin(request: FastifyRequest): Promise<void> {
  if (!(await isSeoPluginEnabled(request.server.database))) {
    throw new SeoPluginDisabledError();
  }
}
