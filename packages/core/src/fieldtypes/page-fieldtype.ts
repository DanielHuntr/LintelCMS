import {
  applyScriptRule,
  findChangedCode,
  type PageDocument,
  validatePageDocument,
} from "@lintel/builder-model";
import { z } from "zod";
import { checkBlockInstances } from "../blocks/block-instances.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { removeScriptsFromCodeHtml } from "./code-html-cleaner.js";
import { defineFieldtype } from "./fieldtype.js";

/**
 * A page designed in the visual builder: a tree of elements with their styles, stored as the
 * page document described in `@lintel/builder-model`. Saving checks the whole tree, refuses
 * new code from people without `builder:code`, and applies the site's rule for scripts
 * (see src/pages/README.md). Instances of the site's own blocks are checked against their
 * block's properties (see src/blocks).
 */
export const pageFieldtype = defineFieldtype({
  type: "page",
  name: "Page design",
  description: "A page you design visually, with sections, text, pictures and buttons.",
  category: "advanced",
  keywords: ["visual", "designer", "layout", "canvas", "drag and drop"],
  optionsSchema: z.object({}),

  buildValueSchema: (_options, label) =>
    z.unknown().transform((value, context) => {
      const checked = validatePageDocument(value, pageComponentCatalogue);
      if (!checked.ok) {
        for (const problem of checked.problems.slice(0, 1)) {
          context.issues.push({
            code: "custom",
            message: `${label}: ${problem.message}`,
            input: value,
          });
        }
        return z.NEVER;
      }
      return checked.document;
    }),

  isEmpty: (value) => isPage(value) && value.root.children.length === 0,

  // The site's blocks on the page: each instance's values against its block's properties.
  checkNestedValues: (value, _options, label, checkFieldValues, context) =>
    checkBlockInstances(value as PageDocument, label, checkFieldValues, context.blockLibrary),

  checkChange: (value, previousValue, label, context) => {
    const rules = context.pageCode;
    if (!rules) return { value };
    const page = applyScriptRule(
      value as PageDocument,
      rules.scriptRule,
      removeScriptsFromCodeHtml,
    );
    if (!rules.mayEditCode) {
      const previous = validatePageDocument(previousValue, pageComponentCatalogue);
      const changed = findChangedCode(
        previous.ok ? previous.document : null,
        page,
        pageComponentCatalogue,
      );
      if (changed.length > 0) {
        return {
          problem: `${label}: only people allowed to edit code can add or change code. Ask a developer, or undo the change.`,
        };
      }
    }
    return { value: page };
  },
});

function isPage(value: unknown): value is PageDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    "root" in value &&
    typeof value.root === "object" &&
    value.root !== null &&
    "children" in value.root &&
    Array.isArray(value.root.children)
  );
}
