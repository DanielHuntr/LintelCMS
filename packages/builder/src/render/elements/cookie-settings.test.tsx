import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { describe, expect, it } from "vitest";
import { renderPage } from "../render-page.js";
import { standardRegistry } from "../stand-in-components.js";
import { sampleSite } from "./navigation.js";

function page(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("c");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

describe("Cookie settings and consent frames", () => {
  it("shows Cookie settings only on a site with the notice, and always on the canvas", () => {
    const document = page({ type: "cookieSettings" });
    const draw = (mode: "site" | "canvas", cookieNotice: boolean) =>
      renderPage(document, standardRegistry, {
        mode,
        data: { site: { ...sampleSite, cookieNotice } },
      }).html;
    expect(draw("site", false)).not.toContain("Cookie settings");
    expect(draw("site", true)).toContain("data-lintel-cookie-settings");
    expect(draw("canvas", false)).toContain("Cookie settings");
  });

  it("marks each waiting frame with the service a visitor's choice allows", () => {
    const { html } = renderPage(
      page(
        { type: "video", props: { source: "vimeo", url: "https://vimeo.com/123456789" } },
        { type: "embed", props: { url: "https://calendly.com/bakery" } },
        { type: "embed", props: { url: "https://calendly.com/bakery", loadsStraightAway: true } },
      ),
      standardRegistry,
      { mode: "site" },
    );
    expect(html).toContain('data-consent-service="vimeo"');
    expect(html.match(/data-consent-service="embed:calendly.com"/g)).toHaveLength(1);
  });
});
