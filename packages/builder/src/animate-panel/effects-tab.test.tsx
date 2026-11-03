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

async function openMotion(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Title" }));
  await user.click(screen.getByRole("tab", { name: "Animate" }));
}

describe("the Motion panel", () => {
  it("adds an effect by when it moves, changes it in plain words and removes it", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder();
    await openMotion(user);
    expect(screen.getByText("Nothing moves yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    expect(screen.getByRole("heading", { name: "When should it move?" })).toBeInTheDocument();
    // A heading is text, so Appears offers word effects, and no 3D galleries anywhere.
    expect(screen.getByRole("region", { name: "Words" })).toBeInTheDocument();
    // Choosing a moment shows its groups; the arrow keys move between moments.
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(screen.getByRole("region", { name: "Pictures and buttons" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Appears" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: /^Scramble/ }));
    expect(findNode(latest().root, "n2")?.effects).toEqual([
      { effect: "scramble-in", params: { duration: 900, trigger: "view" } },
    ]);

    await user.selectOptions(screen.getByRole("combobox", { name: "When it plays" }), "hover");
    expect(findNode(latest().root, "n2")?.effects?.[0]?.params.trigger).toBe("hover");

    await user.click(screen.getByRole("button", { name: "Motion" }));
    const list = screen.getByRole("list", { name: "What moves" });
    expect(within(list).getByRole("button", { name: "Edit Scramble" })).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Edit Scramble" }));
    await user.click(screen.getByRole("button", { name: "Remove Scramble" }));
    expect(findNode(latest().root, "n2")?.effects).toBeUndefined();
    expect(screen.getByText("Nothing moves yet")).toBeInTheDocument();
  });

  it("searches every moment at once, offering only what suits the element", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await openMotion(user);
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.type(screen.getByRole("searchbox", { name: "Search all motion" }), "scramble");
    expect(screen.getByRole("button", { name: /^Scramble/ })).toBeInTheDocument();
    expect(screen.getByText(/^[0-9]+ match/)).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search all motion" }));
    await user.type(screen.getByRole("searchbox", { name: "Search all motion" }), "cylinder");
    expect(screen.queryByRole("button", { name: /^Cylinder gallery/ })).not.toBeInTheDocument();
  });

  it("makes an animation effect the element's animation, and edits it in Simple", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder();
    await openMotion(user);
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("button", { name: /^Letters rise/ }));
    const animation = findNode(latest().root, "n2")?.animation;
    expect(animation?.presetId).toBe("letters-rise");
    expect(animation?.spec.targets).toEqual({ type: "text", split: "letters" });
    expect(screen.getByRole("heading", { name: "Letters rise" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Motion" }));
    expect(
      within(screen.getByRole("list", { name: "What moves" })).getByRole("button", {
        name: "Edit Letters rise",
      }),
    ).toBeInTheDocument();
  });

  it("offers the site-wide motion settings when nothing is selected", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderBuilder({ value: defaultSiteEffectSettings, onChange });
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    expect(screen.getByRole("heading", { name: "Motion across the site" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Page transition" }), "slide");
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
