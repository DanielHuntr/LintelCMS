import { apiRequest } from "../api/client.js";

/** Calls about the templates folder's Liquid page templates (see core's src/liquid-templates). */

export interface LiquidTemplateSummary {
  /** Its path under `templates/`, without `.liquid`: "landing", "pages/wide". */
  name: string;
  /** The collection it is the template of, or null for one pages can choose. */
  collectionHandle: string | null;
}

export function listLiquidTemplates() {
  return apiRequest<{ templates: LiquidTemplateSummary[] }>("/website/liquid-templates");
}
