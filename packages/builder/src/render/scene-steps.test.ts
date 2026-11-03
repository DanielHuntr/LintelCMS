import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { findPreset } from "@lintel/motion/presets";
import { describe, expect, it } from "vitest";
import { renderPage } from "./render-page.js";
import { standardRegistry } from "./stand-in-components.js";

describe("scroll scene steps on the website", () => {
  it("marks the section a step follows, so the step can find it", () => {
    const section = createNode(
      { type: "section", name: "Story", children: [{ type: "heading", name: "Title" }] },
      standardCatalogue,
      createCountingNodeIds("s"),
    );
    const base = findPreset("parallax-slow")!.spec;
    section.children[0]!.animations = [
      {
        spec: {
          ...base,
          trigger: {
            ...base.trigger,
            follows: section.id,
            range: { from: 0.5, to: 1 },
          } as typeof base.trigger,
        },
      },
    ];
    const page = createEmptyPage();
    const document: PageDocument = { ...page, root: { ...page.root, children: [section] } };

    const rendered = renderPage(document, standardRegistry, { withMotion: true });

    expect(rendered.html).toContain(`data-node-id="${section.id}"`);
    expect(rendered.animations[0]?.spec.trigger).toMatchObject({ follows: section.id });
  });
});
