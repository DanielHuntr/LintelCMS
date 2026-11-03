import { describe, expect, it } from "vitest";
import { addDesignUses, countDesignUsesIn, type SiteDesignUses } from "./site-design-uses.js";

const element = (styles: object, children: object[] = [], sharedStyle?: string) => ({
  type: "box",
  styles,
  children,
  ...(sharedStyle ? { sharedStyle } : {}),
});

describe("counting site styles across the site", () => {
  it("finds elements anywhere in a page's values, including hover and screen-size styles", () => {
    const values = {
      title: "Home",
      design: {
        root: element({ base: { color: "var(--lintel-var-ink)" } }, [
          element(
            { base: {}, phone: { padding: "var(--lintel-var-gutter)" } },
            [element({ hover: { color: "var(--lintel-var-ink)" } }, [], "card")],
            "card",
          ),
        ]),
      },
    };
    const counts = countDesignUsesIn(values);
    expect(Object.fromEntries(counts.variables)).toEqual({ ink: 2, gutter: 1 });
    expect(Object.fromEntries(counts.sharedStyles)).toEqual({ card: 2 });
  });

  it("adds up uses, and counts a page once however often it uses one", () => {
    const total: SiteDesignUses = { variables: {}, sharedStyles: {} };
    const page = countDesignUsesIn(
      element({ base: { color: "var(--lintel-var-ink)" } }, [], "card"),
    );
    addDesignUses(total, page, true);
    addDesignUses(total, page, true);
    addDesignUses(total, page, false);
    expect(total).toEqual({
      variables: { ink: { uses: 3, pages: 2 } },
      sharedStyles: { card: { uses: 3, pages: 2 } },
    });
  });
});
