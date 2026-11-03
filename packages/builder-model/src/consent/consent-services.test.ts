import { describe, expect, it } from "vitest";
import type { PageNode } from "../document/page-document.schema.js";
import {
  consentServiceForEmbed,
  consentServicesInDesign,
  consentVersion,
  listServiceNames,
} from "../index.js";

const node = (
  type: string,
  props: Record<string, unknown> = {},
  children: PageNode[] = [],
): PageNode =>
  ({ id: `${type}-${Math.random()}`, type, props, styles: {}, children }) as unknown as PageNode;

describe("the services a design uses", () => {
  it("finds videos, maps and embeds, inside the site's own blocks too", () => {
    const block = { design: node("box", {}, [node("map")]) };
    const root = node("page", {}, [
      node("video", { source: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" }),
      node("video", { source: "file", url: "/media/a.mp4" }),
      node("video", { source: "vimeo", url: "" }),
      node("embed", { url: "https://docs.google.com/forms/x" }),
      node("embed", { url: "https://open.spotify.com/x", loadsStraightAway: true }),
      node("customBlock", { block: "visit", values: {} }),
    ]);
    expect(consentServicesInDesign(root, new Map([["visit", block]]))).toEqual([
      { id: "youtube", name: "YouTube" },
      { id: "embed:docs.google.com", name: "Google Docs" },
      { id: "openstreetmap", name: "OpenStreetMap" },
    ]);
  });

  it("names embeds by their service and gives a stable version", () => {
    expect(consentServiceForEmbed("https://www.youtube-nocookie.com/embed/x")?.id).toBe("youtube");
    expect(consentServiceForEmbed("https://calendly.com/me")).toEqual({
      id: "embed:calendly.com",
      name: "Calendly",
    });
    expect(consentServiceForEmbed("")).toBeNull();
    expect(consentVersion([{ id: "youtube" }, { id: "adobe-fonts" }])).toBe("adobe-fonts youtube");
    expect(listServiceNames([{ name: "A" }, { name: "B" }, { name: "C" }])).toBe("A, B and C");
  });
});
