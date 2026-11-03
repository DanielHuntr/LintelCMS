import { createHash } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { readPluginSettings } from "../plugins/plugin-settings.service.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import type { Site } from "../sites/sites.table.js";
import type { SiteResponse } from "../website/rendered-pages-cache.js";
import { analyticsSettingsSchema, defaultAnalyticsSettings } from "./analytics-settings.schema.js";

/**
 * The one line a published page gets while the Visitors plugin is on:
 *
 *   <script defer src="/_lintel/api/analytics/script.js" data-site="main"></script>
 *
 * It is added as the page is sent, not when it is drawn, so the cached page is the same
 * either way and switching the plugin on or off needs nothing emptied. Drafts, previews and
 * error pages never get it.
 */

export const ANALYTICS_SCRIPT_PATH = "/_lintel/api/analytics/script.js";

/** Whether the plugin is on is read at most this often per site. */
const REMEMBER_MS = 15_000;
const remembered = new Map<string, { tag: string; readAt: number }>();

export async function readAnalyticsTag(
  database: DatabaseOrTransaction,
  plugin: LintelPlugin,
  site: Site,
  now = Date.now(),
): Promise<string> {
  const known = remembered.get(site.id);
  if (known && now - known.readAt < REMEMBER_MS) return known.tag;
  let tag = "";
  if (await isPluginEnabled(database, plugin.id)) {
    const stored = analyticsSettingsSchema.safeParse(await readPluginSettings(database, plugin));
    const settings = stored.success ? stored.data : defaultAnalyticsSettings;
    tag = analyticsTag(site.handle, settings.countOnlyAfterConsent);
  }
  remembered.set(site.id, { tag, readAt: now });
  return tag;
}

/** For tests and after the plugin's switch or settings change: read again next time. */
export function forgetAnalyticsTags(): void {
  remembered.clear();
}

export function analyticsTag(siteHandle: string, waitForConsent: boolean): string {
  const handle = siteHandle.replace(/[^a-z0-9_-]/gi, "");
  const consent = waitForConsent ? ' data-consent="required"' : "";
  return `<script defer src="${ANALYTICS_SCRIPT_PATH}" data-site="${handle}"${consent}></script>`;
}

/** The page with the tag before `</head>`, when it is a public page that was found. */
export function withAnalyticsTag(response: SiteResponse, tag: string): SiteResponse {
  if (!tag || response.statusCode !== 200) return response;
  if (!response.headers["content-type"]?.startsWith("text/html")) return response;
  if (response.headers["cache-control"]?.includes("no-store")) return response;
  const headEnd = response.body.indexOf("</head>");
  if (headEnd === -1) return response;
  const etag = response.headers.etag;
  return {
    ...response,
    headers: {
      ...response.headers,
      ...(etag ? { etag: etag.replace(/"$/, `-${tagFingerprint(tag)}"`) } : {}),
    },
    body: `${response.body.slice(0, headEnd)}${tag}${response.body.slice(headEnd)}`,
  };
}

/** The ETag changes with the tag, so a browser never keeps a page with an old one. */
function tagFingerprint(tag: string): string {
  return createHash("sha256").update(tag).digest("hex").slice(0, 8);
}
