import { cleanTemplate } from "./clean-template.js";
import { journalTemplate } from "./journal-template.js";
import type { SiteTemplate } from "./site-template.js";

/** The built-in templates, in the order the picker shows them. */
export const builtInTemplates: readonly SiteTemplate[] = [cleanTemplate, journalTemplate];

/** The template with this id from the list, or the first one when it isn't there. */
export function findTemplate(
  id: string,
  templates: readonly SiteTemplate[] = builtInTemplates,
): SiteTemplate {
  return templates.find((template) => template.id === id) ?? templates[0] ?? cleanTemplate;
}
