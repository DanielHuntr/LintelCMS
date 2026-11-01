import type { NodeBlueprint } from "../components/component-definition.js";
import { container, section } from "./section-parts.js";
import { type SectionIntro, sectionIntro } from "./features.js";

/**
 * Sections that show products from the shop. They hold the shop's own elements, so they are
 * only offered while the shop (the commerce plugin) is switched on.
 */
export function productShowcase(
  copy: SectionIntro & {
    limit: number;
    columns: number;
    /** Lets visitors change the order and see more pages: for a whole range, not a few picks. */
    browsable: boolean;
  },
): NodeBlueprint {
  return section("Products", [
    container([
      sectionIntro(copy),
      {
        type: "productGrid",
        name: "Product grid",
        props: {
          limit: copy.limit,
          columns: copy.columns,
          showSort: copy.browsable,
          paginate: copy.browsable,
        },
      },
    ]),
  ]);
}
