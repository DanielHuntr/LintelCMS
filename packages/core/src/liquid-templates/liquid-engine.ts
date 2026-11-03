import { join } from "node:path";
import { Liquid } from "liquidjs";
import { registerLintelTags } from "./liquid-tags.js";
import {
  LAYOUTS_SUBFOLDER,
  PARTIALS_SUBFOLDER,
  TEMPLATE_EXTENSION,
  TEMPLATES_SUBFOLDER,
} from "./templates-folder.repository.js";

/**
 * The Liquid engine for one templates folder, set up strictly:
 *
 * - files are read only from the folder's templates/, layouts/ and partials/ (LiquidJS
 *   checks each file's real path is inside them, so `../` and links out are refused), and
 *   never relative to the file doing the including;
 * - everything printed with `{{ }}` is HTML-escaped; `| rich_text` and Lintel's own tags
 *   write the HTML Lintel made, and `| raw` is there for anything else a developer trusts;
 * - an unknown filter or variable is an error rather than nothing (an unknown variable in
 *   `{% if %}` or before `| default` is fine, so optional values read naturally);
 * - objects show only their own properties, and a page that takes over five seconds to
 *   draw is stopped.
 *
 * Parsed templates are kept when `cache` is on (production); in development a new engine
 * is made whenever a file changes (see liquid-templates.service.ts).
 */
export function createLiquidEngine(folder: string, options: { cache: boolean }): Liquid {
  const engine = new Liquid({
    root: [join(folder, TEMPLATES_SUBFOLDER)],
    layouts: [join(folder, LAYOUTS_SUBFOLDER)],
    partials: [join(folder, PARTIALS_SUBFOLDER)],
    extname: TEMPLATE_EXTENSION,
    relativeReference: false,
    cache: options.cache,
    strictFilters: true,
    strictVariables: true,
    lenientIf: true,
    ownPropertyOnly: true,
    outputEscape: "escape",
    renderLimit: 5000,
  });
  registerLintelTags(engine);
  return engine;
}
