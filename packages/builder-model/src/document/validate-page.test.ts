import { describe, expect, it } from "vitest";
import { standardCatalogue } from "../components/component-catalogue.js";
import { createNode } from "../tree/create-node.js";
import { createCountingNodeIds } from "../tree/node-ids.js";
import { sectionTemplates } from "../templates/section-templates.js";
import { migrateDocument, UnknownPageVersionError, type DocumentMigration } from "./migrations.js";
import { createEmptyPage, type PageDocument } from "./page-document.schema.js";
import { validatePageDocument } from "./validate-page.js";

function pageWith(...children: PageDocument["root"]["children"]): PageDocument {
  const page = createEmptyPage();
  return { ...page, root: { ...page.root, children } };
}

const createId = createCountingNodeIds();
const heading = (props: Record<string, unknown> = {}) =>
  createNode({ type: "heading", props }, standardCatalogue, createId);

describe("checking a page", () => {
  it("accepts an empty page and fills in defaults on bare nodes", () => {
    const result = validatePageDocument(
      { version: 1, root: { id: "page", type: "page", children: [{ id: "a", type: "heading" }] } },
      standardCatalogue,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.document.root.children[0]).toMatchObject({
      name: "",
      props: { text: "Heading", level: 2 },
      styles: { base: {} },
      hidden: false,
      locked: false,
    });
  });

  it("accepts every section template", () => {
    for (const template of sectionTemplates) {
      const section = createNode(template.blueprint, standardCatalogue, createId);
      expect(validatePageDocument(pageWith(section), standardCatalogue).ok, template.id).toBe(true);
    }
  });

  it("names the element with a problem in its props", () => {
    const result = validatePageDocument(
      pageWith(heading(), heading({ level: 9 })),
      standardCatalogue,
    );
    expect(result).toEqual({
      ok: false,
      problems: [
        {
          nodeId: expect.any(String),
          message: "Heading 2: A heading level should be a number from 1 to 6",
        },
      ],
    });
  });

  it("refuses unknown elements, repeated ids and elements in the wrong place", () => {
    const first = heading();
    const inner = { ...heading(), id: first.id };
    const result = validatePageDocument(
      pageWith(
        first,
        { ...first, id: "x1", children: [inner] },
        { ...first, id: "x2", type: "carousel" },
      ),
      standardCatalogue,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.map((problem) => problem.message)).toEqual([
      `Heading 3: two elements have the id “${first.id}”`,
      "Heading 3 can’t go inside Heading",
      "carousel 1: there is no “carousel” element",
    ]);
  });

  it("refuses unknown and unsafe styles", () => {
    const unknown = { ...heading(), styles: { base: { float: "left" } as Record<string, string> } };
    const unsafe = {
      ...heading(),
      styles: { base: {}, phone: { color: "red; background: url(x)" } },
    };
    expect(validatePageDocument(pageWith(unknown), standardCatalogue)).toMatchObject({
      ok: false,
      problems: [{ message: "“float” isn’t a style the builder knows (in the styles for base)" }],
    });
    expect(validatePageDocument(pageWith(unsafe), standardCatalogue)).toMatchObject({
      ok: false,
      problems: [
        {
          message:
            "“red; background: url(x)” isn’t a value color can have (in the styles for phone)",
        },
      ],
    });
  });

  it("refuses javascript: links", () => {
    const button = createNode(
      { type: "button", props: { href: "javascript:alert(1)" } },
      standardCatalogue,
      createId,
    );
    expect(validatePageDocument(pageWith(button), standardCatalogue)).toMatchObject({
      ok: false,
      problems: [
        { message: "Button 1: A link should start with https://, http://, mailto:, tel:, / or #" },
      ],
    });
  });

  it("refuses a page nested too deeply before parsing it", () => {
    let node: Record<string, unknown> = { id: "leaf", type: "box" };
    for (let depth = 0; depth < 60; depth += 1)
      node = { id: `b${depth}`, type: "box", children: [node] };
    const result = validatePageDocument(
      { version: 1, root: { id: "page", type: "page", children: [node] } },
      standardCatalogue,
    );
    expect(result).toEqual({
      ok: false,
      problems: [{ nodeId: null, message: "Elements can be nested at most 40 deep" }],
    });
  });

  it("says when a page comes from a newer Lintel", () => {
    expect(validatePageDocument({ version: 7, root: {} }, standardCatalogue)).toEqual({
      ok: false,
      problems: [{ nodeId: null, message: expect.stringContaining("newer version of Lintel") }],
    });
  });
});

describe("migrating a page", () => {
  const migrations: DocumentMigration[] = [
    { from: 1, to: 2, describe: "Names moved", migrate: (page) => ({ ...page, moved: true }) },
    { from: 2, to: 3, describe: "Again", migrate: (page) => ({ ...page, again: true }) },
  ];

  it("runs each migration in turn up to the current version", () => {
    expect(migrateDocument({ version: 1 }, migrations, 3)).toEqual({
      version: 3,
      moved: true,
      again: true,
    });
  });

  it("leaves a current page alone", () => {
    const page = createEmptyPage();
    expect(migrateDocument(page)).toBe(page);
  });

  it("refuses a version with no way forward", () => {
    expect(() => migrateDocument({ version: 0 }, migrations, 3)).toThrow(UnknownPageVersionError);
  });
});

describe("animations on elements", () => {
  const withAnimation = (animation: unknown) => ({
    version: 1,
    root: {
      id: "page",
      type: "page",
      children: [{ id: "h1", type: "heading", props: { text: "Hi", level: 1 }, animation }],
    },
  });

  it("keeps a valid animation, with the spec's defaults filled in", () => {
    const checked = validatePageDocument(
      withAnimation({
        presetId: "fade-in",
        spec: {
          trigger: { type: "inView" },
          tracks: [
            {
              property: "opacity",
              keyframes: [
                { offset: 0, value: 0 },
                { offset: 1, value: 1 },
              ],
            },
          ],
        },
      }),
      standardCatalogue,
    );
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;
    const animation = checked.document.root.children[0]?.animation;
    expect(animation?.presetId).toBe("fade-in");
    expect(animation?.spec.duration).toBe(600);
    expect(animation?.spec.reducedMotion).toBe("fade");
  });

  it("refuses an animation the runtime couldn't play", () => {
    const checked = validatePageDocument(
      withAnimation({ spec: { trigger: { type: "inView" }, tracks: [] } }),
      standardCatalogue,
    );
    expect(checked.ok).toBe(false);
  });

  it("leaves elements without an animation as they are", () => {
    const checked = validatePageDocument(withAnimation(undefined), standardCatalogue);
    expect(checked.ok).toBe(true);
    if (checked.ok) expect(checked.document.root.children[0]?.animation).toBeUndefined();
  });
});
