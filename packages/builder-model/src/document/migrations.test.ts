import { describe, expect, it } from "vitest";
import { migrateDocument, UnknownPageVersionError } from "./migrations.js";
import { pageDocumentVersion } from "./page-document.schema.js";

describe("page document migrations", () => {
  it("turns version 1's one animation per element into version 2's list, everywhere in the page", () => {
    const fade = { spec: { trigger: { type: "inView" } }, presetId: "fade-in" };
    const migrated = migrateDocument({
      version: 1,
      root: {
        id: "page",
        type: "page",
        children: [
          {
            id: "a",
            type: "section",
            animation: fade,
            children: [{ id: "b", type: "heading", animation: fade }],
          },
          { id: "c", type: "text" },
        ],
      },
    }) as { version: number; root: { children: Array<Record<string, unknown>> } };

    expect(migrated.version).toBe(pageDocumentVersion);
    const [section, text] = migrated.root.children;
    expect(section).toMatchObject({ animations: [fade] });
    expect(section).not.toHaveProperty("animation");
    expect((section?.children as Array<Record<string, unknown>>)[0]).toMatchObject({
      animations: [fade],
    });
    expect(text).not.toHaveProperty("animations");
  });

  it("leaves a current page as it is, and refuses one from a newer Lintel", () => {
    const current = {
      version: pageDocumentVersion,
      root: { id: "page", type: "page", children: [] },
    };
    expect(migrateDocument(current)).toBe(current);
    expect(() => migrateDocument({ version: pageDocumentVersion + 1, root: {} })).toThrow(
      UnknownPageVersionError,
    );
  });
});
