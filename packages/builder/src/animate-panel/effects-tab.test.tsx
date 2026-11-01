import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { defaultSiteEffectSettings, type SiteEffectSettings } from "@lintel/motion/effects";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";
import { elementKindOf } from "./element-kinds.js";

function headingPage(): PageDocument {
  const page = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Welcome",
      children: [{ type: "heading", name: "Title", props: { text: "Fresh bread", level: 1 } }],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

function renderBuilder(siteEffects?: {
  value: SiteEffectSettings;
  onChange: (value: SiteEffectSettings) => void;
}) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={headingPage()}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes" })}
      siteEffects={siteEffects}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

async function openEffects(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Title" }));
  await user.click(screen.getByRole("tab", { name: "Animate" }));
  await user.click(screen.getByRole("button", { name: "Effects" }));
}

describe("the Effects tab", () => {
  it("adds an effect, changes its settings in plain words and removes it, all undoable", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder();
    await openEffects(user);
    expect(screen.getByRole("heading", { name: "Effects for Title" })).toBeInTheDocument();
    // A heading is text, so the gallery offers text effects and not 3D galleries.
    expect(screen.queryByRole("button", { name: "Add Cylinder gallery" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add Scramble" }));
    expect(findNode(latest().root, "n2")?.effects).toEqual([
      { effect: "scramble-in", params: { duration: 900, trigger: "view" } },
    ]);
    expect(screen.getByText(/^Effects: 1, adding/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "When it plays" }), "hover");
    expect(findNode(latest().root, "n2")?.effects?.[0]?.params.trigger).toBe("hover");

    await user.click(screen.getByRole("button", { name: "Remove Scramble" }));
    expect(findNode(latest().root, "n2")?.effects).toBeUndefined();
  });

  it("finds effects by search, and shows every kind when asked", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await openEffects(user);
    await user.click(screen.getByRole("checkbox", { name: "Only ones that suit this element" }));
    await user.type(screen.getByRole("searchbox", { name: "Search effects" }), "carousel");
    expect(screen.getByRole("button", { name: "Add Cylinder gallery" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Scramble" })).not.toBeInTheDocument();
  });

  it("turns an animation effect into the element's animation, ready for the timeline", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder();
    await openEffects(user);
    await user.click(screen.getByRole("button", { name: "Add Letters rise" }));
    const animation = findNode(latest().root, "n2")?.animation;
    expect(animation?.presetId).toBe("letters-rise");
    expect(animation?.spec.targets).toEqual({ type: "text", split: "letters" });
    expect(screen.getByRole("heading", { name: "Animation for Title" })).toBeInTheDocument();
  });

  it("offers the site-wide motion settings when nothing is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder({ value: defaultSiteEffectSettings, onChange });
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    expect(screen.getByRole("heading", { name: "Motion across the site" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Slide" }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageTransition: { style: "slide", duration: 450 } }),
    );
  });
});

describe("rendering effects", () => {
  const page = (): PageDocument => {
    const document = headingPage();
    const title = findNode(document.root, "n2")!;
    title.effects = [
      { effect: "flip-on-hover", params: {} },
      { effect: "magnetic-pull", params: { strength: 0.5 } },
    ];
    return document;
  };

  it("marks the element and lists its effects on the website", () => {
    const rendered = renderPage(page(), standardRegistry, { withMotion: true });
    expect(rendered.html).toContain('data-node-id="n2"');
    expect(rendered.effects.map((binding) => binding.behaviour)).toEqual(["flipCard", "magnetic"]);
    expect(rendered.css).toContain('[data-node-id="n2"] > :nth-child(2)');
  });

  it("writes static CSS for the canvas's own attribute", () => {
    const rendered = renderPage(page(), standardRegistry, { mode: "canvas" });
    expect(rendered.css).toContain('[data-lintel-node="n2"]');
    expect(rendered.html).not.toContain("data-node-id");
  });

  it("starts the ready-made animated elements with their effects, as readable HTML", () => {
    const document = createEmptyPage();
    const ids = createCountingNodeIds("x");
    const elements = [
      "magneticButton",
      "toggleSwitch",
      "radialMenu",
      "notificationToast",
      "cardStack",
    ].map((type) => createNode({ type }, standardCatalogue, ids));
    expect(elements.map((node) => node.effects?.map((effect) => effect.effect))).toEqual([
      ["magnetic-pull", "press-squish"],
      ["spring-switch"],
      ["radial-menu"],
      ["toast"],
      ["card-stack"],
    ]);
    const rendered = renderPage(
      { ...document, root: { ...document.root, children: elements } },
      standardRegistry,
      { withMotion: true },
    );
    expect(rendered.html).toContain(
      'role="switch" aria-checked="false" aria-label="Yearly prices"',
    );
    expect(rendered.html).toContain('<a href="mailto:" class="lintel-radial-menu__link">Email</a>');
    expect(rendered.html).toContain("lintel-toast--bottom-right");
    expect(rendered.effects.map((binding) => binding.behaviour)).toEqual([
      "magnetic",
      "springPress",
      "springToggle",
      "radialMenu",
      "toast",
      "cardStack",
    ]);
  });

  it("knows which kind of element each component is", () => {
    expect(elementKindOf("heading")).toBe("text");
    expect(elementKindOf("image")).toBe("image");
    expect(elementKindOf("somethingNew")).toBe("any");
  });
});
