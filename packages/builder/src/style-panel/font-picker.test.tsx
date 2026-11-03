import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CanvasSite } from "../canvas/canvas-frame-script.js";
import { canvasFrameSource } from "../canvas/canvas-frame-script.js";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { fontChoiceGroups, type UploadedPageFont } from "./font-choices.js";

const heading: NodeBlueprint = {
  type: "section",
  name: "Hero",
  children: [{ type: "heading", name: "Title", props: { text: "Fresh bread", level: 1 } }],
};

const studioSans: UploadedPageFont = {
  source: "upload",
  family: "Studio Sans",
  category: "sans",
  files: [
    { src: "/media/studio.woff2", assetId: "a1", weight: "400", style: "normal", format: "woff2" },
  ],
};

const site: CanvasSite = {
  stylesheet: "",
  bodyClassName: "lintel-site",
  headerHtml: "",
  footerHtml: "",
  baseUrl: null,
  motionScript: "",
  fonts: [
    { family: "Lora", category: "serif", source: "google" },
    { family: "proxima-nova", category: "sans", source: "adobe" },
  ],
  fontStylesheets: ["https://use.typekit.net/abc1def.css"],
};

function renderBuilder(options: {
  onAddFont?: () => void;
  onMoveFontToSite?: (font: UploadedPageFont) => Promise<boolean>;
  titleFont?: string;
}) {
  const page = createEmptyPage();
  const hero = createNode(heading, standardCatalogue, createCountingNodeIds());
  const title = hero.children[0];
  const document: PageDocument = {
    ...page,
    root: {
      ...page.root,
      props: { fonts: [studioSans] },
      children: [
        {
          ...hero,
          children: title
            ? [
                {
                  ...title,
                  styles: { base: options.titleFont ? { fontFamily: options.titleFont } : {} },
                },
              ]
            : [],
        },
      ],
    },
  };
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      site={site}
      onAddFont={options.onAddFont}
      onMoveFontToSite={options.onMoveFontToSite}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes", skillLevel: "beginner" })}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

async function openText(person: ReturnType<typeof userEvent.setup>) {
  await person.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Title" }));
  const button = screen
    .getAllByRole("button")
    .find(
      (candidate) =>
        candidate.hasAttribute("aria-expanded") &&
        !candidate.hasAttribute("aria-haspopup") &&
        (candidate.textContent ?? "").startsWith("Text"),
    );
  if (!button) throw new Error("No Text group");
  if (button.getAttribute("aria-expanded") !== "true") await person.click(button);
  return button.closest("section") as HTMLElement;
}

describe("the font list", () => {
  it("groups the theme's, the site's, this page's and the included fonts", () => {
    const groups = fontChoiceGroups(site.fonts ?? [], [studioSans], {
      heading: "Heading font",
      body: "Body font",
    });
    expect(
      groups.map((group) => [group.id, group.choices.map((choice) => choice.label).slice(0, 3)]),
    ).toEqual([
      ["theme", ["Heading font", "Body font"]],
      ["site", ["Lora", "proxima-nova"]],
      ["page", ["Studio Sans"]],
      // Lora is a site font here, so it is listed once, with the site's.
      ["included", ["Inter", "DM Sans", "Space Grotesk"]],
    ]);
    expect(groups.at(-1)?.choices.some((choice) => choice.label === "Lora")).toBe(false);
  });

  it("offers the site's fonts and opens the site's fonts to add one", async () => {
    const person = userEvent.setup();
    const onAddFont = vi.fn();
    const { latest } = renderBuilder({ onAddFont });
    const group = await openText(person);
    const select = within(group).getByRole("combobox", { name: "Font" });

    expect(within(select).getByRole("group", { name: "Site fonts" })).toBeTruthy();
    await person.selectOptions(select, "'Lora', Georgia, serif");
    expect(latest().root.children[0]?.children[0]?.styles.base.fontFamily).toBe(
      "'Lora', Georgia, serif",
    );
    // A site font needs nothing added to the page.
    expect(latest().root.props.fonts).toEqual([studioSans]);

    await person.click(within(group).getByRole("button", { name: "Add a font" }));
    expect(onAddFont).toHaveBeenCalledOnce();
  });

  it("moves a font uploaded to this page alone to the whole site", async () => {
    const person = userEvent.setup();
    const onMoveFontToSite = vi.fn(async () => true);
    const { latest } = renderBuilder({
      onMoveFontToSite,
      titleFont: "'Studio Sans', system-ui, sans-serif",
    });
    const group = await openText(person);

    expect(within(group).getByText("Only this page has this font.")).toBeTruthy();
    await person.click(within(group).getByRole("button", { name: "Use it on every page" }));

    expect(onMoveFontToSite).toHaveBeenCalledWith(studioSans);
    expect(latest().root.props.fonts).toEqual([]);
    // The element keeps its font: the site's has the same name.
    expect(latest().root.children[0]?.children[0]?.styles.base.fontFamily).toBe(
      "'Studio Sans', system-ui, sans-serif",
    );
  });
});

describe("the canvas", () => {
  it("links Adobe's stylesheet as the website does, and nothing that isn't https", () => {
    const source = canvasFrameSource({
      ...site,
      fontStylesheets: ["https://use.typekit.net/abc1def.css", "javascript:alert(1)"],
    });
    expect(source).toContain('<link rel="stylesheet" href="https://use.typekit.net/abc1def.css">');
    expect(source).not.toContain("javascript:");
  });
});
