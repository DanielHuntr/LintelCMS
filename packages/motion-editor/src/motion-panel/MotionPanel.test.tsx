import type { MotionSpec } from "@lintel/motion";
import type { ElementKind, NodeEffect } from "@lintel/motion/effects";
import { findPreset } from "@lintel/motion/presets";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MotionPanel, type SavedAnimation } from "./MotionPanel.js";

interface Saved {
  animations: SavedAnimation[];
  effects: NodeEffect[];
}

/** The panel with its element's motion kept in state, as the builder keeps it on the node. */
function renderPanel(options: { animations?: SavedAnimation[]; elementKind?: ElementKind } = {}) {
  const saved: Saved = { animations: options.animations ?? [], effects: [] };
  const onPreviewSpec = vi.fn<(spec: MotionSpec) => void>();
  const onCommit = vi.fn();
  const onPreviewEffect = vi.fn();
  function Host() {
    const [animations, setAnimations] = useState(saved.animations);
    const [effects, setEffects] = useState<NodeEffect[]>([]);
    return (
      <MotionPanel
        name="Title"
        animations={animations}
        effects={effects}
        elementKind={options.elementKind ?? "text"}
        onChangeAnimations={(next) => {
          saved.animations = next;
          setAnimations(next);
        }}
        onChangeEffects={(next) => {
          saved.effects = next;
          setEffects(next);
        }}
        onPreviewSpec={onPreviewSpec}
        onPreviewEffect={onPreviewEffect}
        onStopPreview={vi.fn()}
        showsTimeline={false}
        onCommit={onCommit}
      />
    );
  }
  render(<Host />);
  return { saved, onPreviewSpec, onPreviewEffect, onCommit, user: userEvent.setup() };
}

const moments = () => screen.getByRole("radiogroup", { name: "When it moves" });
const tiles = () => screen.getByRole("radiogroup", { name: "How it moves" });

describe("adding motion", () => {
  it("asks only when first, with nothing added until a moment is chosen", async () => {
    const { saved, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    expect(screen.getByRole("heading", { name: "When should it move?" })).toBeInTheDocument();
    expect(within(moments()).getAllByRole("radio")).toHaveLength(5);
    for (const radio of within(moments()).getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-checked", "false");
      // Words sit under the icons and are never cut short.
      expect(radio.innerHTML).not.toContain("truncate");
    }
    expect(screen.queryByRole("radiogroup", { name: "How it moves" })).not.toBeInTheDocument();
    expect(screen.queryByText(/choices$/)).not.toBeInTheDocument();
    expect(saved.animations).toEqual([]);
  });

  it("puts a gentle default on the element as soon as a moment is chosen, and plays it", async () => {
    const { saved, onPreviewSpec, onCommit, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    expect(saved.animations).toEqual([{ spec: findPreset("fade-up")!.spec, presetId: "fade-up" }]);
    expect(onPreviewSpec).toHaveBeenLastCalledWith(findPreset("fade-up")!.spec);
    expect(onCommit).toHaveBeenCalled();
    expect(within(tiles()).getByRole("radio", { name: "Fade up" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // A handful of tiles, each a word or two, with the sentence kept for the tooltip.
    const all = within(tiles()).getAllByRole("radio");
    expect(all.length).toBeLessThanOrEqual(6);
    expect(all[0]).toHaveAccessibleDescription(findPreset("fade-up")!.description);
    expect(all[0]).toHaveAttribute("title", findPreset("fade-up")!.description);
  });

  it("swaps the motion, rather than adding more, when another tile or moment is chosen", async () => {
    const { saved, onPreviewSpec, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    await user.click(within(tiles()).getByRole("radio", { name: "Pop in" }));
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["pop-in"]);
    expect(onPreviewSpec).toHaveBeenLastCalledWith(findPreset("pop-in")!.spec);

    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["hover-lift"]);
    await user.click(screen.getByRole("radio", { name: "Click" }));
    await user.click(within(tiles()).getByRole("radio", { name: "Shake" }));
    expect(saved.animations).toHaveLength(1);
    // Under Click, the eye-catcher plays on a click rather than waiting for an event.
    expect(saved.animations[0]?.spec.trigger.type).toBe("click");
  });

  it("moves between moments and tiles with the arrow keys", async () => {
    const { saved, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    within(moments()).getAllByRole("radio")[0]!.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Hover" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Hover" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "Appears" })).toHaveAttribute("aria-checked", "true");

    within(tiles()).getByRole("radio", { name: "Fade up" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(within(tiles()).getByRole("radio", { name: "Fade in" })).toHaveFocus();
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["fade-in"]);
  });

  it("offers how much, how fast, the feel and when it starts, in plain words", async () => {
    const { saved, onPreviewSpec, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    const base = findPreset("fade-up")!.spec;

    fireEvent.change(screen.getByRole("slider", { name: "Speed" }), { target: { value: "0.5" } });
    expect(saved.animations[0]?.spec.duration).toBe(base.duration * 2);
    fireEvent.change(screen.getByRole("slider", { name: "Starts" }), { target: { value: "500" } });
    expect(saved.animations[0]?.spec.delay).toBe(500);
    fireEvent.pointerUp(screen.getByRole("slider", { name: "Starts" }));
    expect(onPreviewSpec).toHaveBeenLastCalledWith(saved.animations[0]?.spec);

    fireEvent.change(screen.getByRole("slider", { name: "How much" }), { target: { value: "2" } });
    const rise = saved.animations[0]?.spec.tracks.find((track) => track.property === "translateY");
    const baseRise = base.tracks.find((track) => track.property === "translateY");
    expect(rise?.keyframes[0]?.value).not.toEqual(baseRise?.keyframes[0]?.value);

    await user.click(screen.getByRole("radio", { name: "Springy" }));
    expect(saved.animations[0]?.spec.easing).toMatchObject({ type: "spring" });
    expect(saved.animations[0]?.presetId).toBe("fade-up");

    // Scroll scenes follow the scroll, so speed, feel and start don't apply.
    await user.click(screen.getByRole("radio", { name: "Scroll" }));
    expect(screen.getByRole("slider", { name: "How much" })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Speed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Starts" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Feel" })).not.toBeInTheDocument();
  });

  // People asked for a video that grows from a tenth of its size while the page scrolls;
  // "How much" once stopped at 60%.
  it("lets a grow while scrolling start as small as a tenth of the element", async () => {
    const { saved, user } = renderPanel({ elementKind: "image" });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Scroll" }));
    await user.click(within(tiles()).getByRole("radio", { name: "Grow" }));
    const howMuch = screen.getByRole("slider", { name: "How much" });
    expect(howMuch).toHaveAttribute("aria-valuetext", "Starts at 80%");
    expect(screen.getByText("Starts at 80%")).toBeInTheDocument();

    fireEvent.change(howMuch, { target: { value: howMuch.getAttribute("max") } });
    const scale = () =>
      saved.animations[0]?.spec.tracks
        .find((track) => track.property === "scale")
        ?.keyframes.map((keyframe) => keyframe.value);
    expect(scale()).toEqual([0.1, 1]);
    expect(howMuch).toHaveAttribute("aria-valuetext", "Starts at 10%");

    fireEvent.change(howMuch, { target: { value: howMuch.getAttribute("min") } });
    expect(scale()).toEqual([0.9, 1]);
  });

  it("keeps the full settings one step away, and lists the motion when done", async () => {
    const { user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    await user.click(screen.getByRole("button", { name: "More settings" }));
    expect(screen.getAllByRole("heading", { name: "Lift" })[0]).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Starts when" })).toHaveValue("hover");

    await user.click(screen.getByRole("button", { name: "Motion" }));
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Always" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    const list = screen.getByRole("list", { name: "What moves" });
    expect(within(list).getByRole("button", { name: "Edit Lift" })).toHaveTextContent("On hover");
    expect(within(list).getByRole("button", { name: "Edit Gentle pulse" })).toHaveTextContent(
      "Always",
    );
  });

  it("opens every preset and effect under More effects, replacing the default with the choice", async () => {
    const { saved, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    await user.click(screen.getByRole("button", { name: "More effects…" }));
    expect(screen.getByRole("heading", { name: "All motion" })).toBeInTheDocument();
    expect(screen.getByText(/^[0-9]+ choices$/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Words" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search all motion" }), "letters rise");
    await user.click(screen.getByRole("button", { name: /^Letters rise/ }));
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["letters-rise"]);
    expect(screen.getByRole("heading", { name: "Letters rise" })).toBeInTheDocument();
  });

  it("goes back from the catalogue to the tiles, keeping what was added", async () => {
    const { saved, user } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Scroll" }));
    await user.click(screen.getByRole("button", { name: "More effects…" }));
    expect(screen.getByRole("radio", { name: "Scroll" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(within(tiles()).getByRole("radio", { name: "Parallax" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["parallax-slow"]);
  });

  it("adds to the motion already there rather than replacing it", async () => {
    const fade: SavedAnimation = { spec: findPreset("fade-up")!.spec, presetId: "fade-up" };
    const first = renderPanel({ animations: [fade] });
    await first.user.click(screen.getByRole("button", { name: "Add motion" }));
    await first.user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(first.saved.animations.map((animation) => animation.presetId)).toEqual([
      "fade-up",
      "hover-lift",
    ]);
  });

  it("adds nothing to an element that has as many animations as it can take", async () => {
    const fade: SavedAnimation = { spec: findPreset("fade-up")!.spec, presetId: "fade-up" };
    const { saved, user } = renderPanel({ animations: Array.from({ length: 6 }, () => fade) });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(screen.getByText(/as many animations as it can take/)).toBeInTheDocument();
    expect(saved.animations).toHaveLength(6);
    expect(within(tiles()).getByRole("radio", { name: "Lift" })).toBeDisabled();
    expect(within(tiles()).getByRole("radio", { name: "Underline" })).toBeDisabled();
    // Effects for words aren't animations, so they can still be added.
    expect(within(tiles()).getByRole("radio", { name: "Roll up" })).toBeEnabled();
  });

  it.each([
    ["text", ["Lift", "Roll up", "Underline", "Scramble", "Wave", "Bolder"]],
    ["button", ["Lift", "Grow", "Roll up", "Underline", "Scramble", "Wave"]],
    ["image", ["Grow", "Liquid", "Colour split", "Lens", "Lift", "Tilt"]],
    ["container", ["Lift", "Grow", "Brighten", "Tilt", "Magnetic", "Swing"]],
  ] as const)("offers %s the best six hover tiles", async (elementKind, names) => {
    const { user } = renderPanel({ elementKind });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    const shown = within(tiles())
      .getAllByRole("radio")
      .map((tile) => names.find((name) => tile.textContent?.startsWith(name)) ?? "");
    expect(shown).toEqual(names);
  });

  it("adds a word effect from its tile as an effect, swapping it for the next tile", async () => {
    const { saved, user } = renderPanel({ elementKind: "button" });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["hover-lift"]);
    await user.click(within(tiles()).getByRole("radio", { name: "Roll up" }));
    expect(saved.animations).toEqual([]);
    expect(saved.effects).toEqual([{ effect: "roll-up", params: { duration: 420 } }]);
    expect(within(tiles()).getByRole("radio", { name: "Roll up" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await user.click(within(tiles()).getByRole("radio", { name: "Scramble" }));
    expect(saved.effects).toEqual([{ effect: "scramble-on-hover", params: { duration: 500 } }]);
    await user.click(within(tiles()).getByRole("radio", { name: "Grow" }));
    expect(saved.effects).toEqual([]);
    expect(saved.animations.map((animation) => animation.presetId)).toEqual(["hover-grow"]);
    await user.click(within(tiles()).getByRole("radio", { name: "Wave" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(saved.effects.map((effect) => effect.effect)).toEqual(["wave-on-hover"]);
    expect(saved.animations).toEqual([]);
  });

  it("adds afresh when undo has taken away what it added", async () => {
    const user = userEvent.setup();
    const onChangeAnimations = vi.fn<(animations: SavedAnimation[]) => void>();
    const panel = (animations: SavedAnimation[]) => (
      <MotionPanel
        name="Title"
        animations={animations}
        effects={[]}
        elementKind="text"
        onChangeAnimations={onChangeAnimations}
        onChangeEffects={vi.fn()}
        onPreviewSpec={vi.fn()}
        onPreviewEffect={vi.fn()}
        onStopPreview={vi.fn()}
        showsTimeline={false}
      />
    );
    const { rerender } = render(panel([]));
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    rerender(panel(onChangeAnimations.mock.lastCall![0]));
    // Undo in the builder takes the fade away again.
    rerender(panel([]));
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(onChangeAnimations.mock.lastCall![0].map((animation) => animation.presetId)).toEqual([
      "hover-lift",
    ]);
  });
});

/** The tiles' visible names (their descriptions are hidden, for screen readers). */
const tileNames = () =>
  within(tiles())
    .getAllByRole("radio")
    .map((tile) => tile.querySelector(":scope > span:nth-child(2)")?.textContent);

describe("backgrounds and picture effects", () => {
  it("offers sections the moving backgrounds under Always, starting with the gradient", async () => {
    const { saved, onPreviewEffect, user } = renderPanel({ elementKind: "container" });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Always" }));
    expect(tileNames()).toEqual(["Gradient", "Soft light", "Dust", "Contours", "Grain"]);
    expect(saved.effects.map((effect) => effect.effect)).toEqual(["moving-gradient"]);
    expect(onPreviewEffect).toHaveBeenCalled();
  });

  it("shows a background's few settings under the tiles, with the site's colours", async () => {
    const { saved, onPreviewEffect, user } = renderPanel({ elementKind: "container" });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Always" }));
    expect(screen.getByRole("slider", { name: /Speed/ })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /How much colour/ })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Keep words readable" })).toBeChecked();
    const first = screen.getByRole("group", { name: /First colour/ });
    await user.click(within(first).getByRole("button", { name: "Brand" }));
    expect(saved.effects[0]?.params.one).toBe("var(--lintel-color-brand)");
    // Each change shows on the page straight away.
    expect(onPreviewEffect.mock.lastCall?.[1]).toMatchObject({ one: "var(--lintel-color-brand)" });
    await user.click(within(tiles()).getByRole("radio", { name: "Dust" }));
    const dust = screen.getByRole("group", { name: /Dust colour/ });
    expect(within(dust).getByRole("button", { name: "Same as the words" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(saved.effects.map((effect) => effect.effect)).toEqual(["floating-dust"]);
  });

  it("offers pictures reveals as they appear", async () => {
    const { saved, user } = renderPanel({ elementKind: "image" });
    await user.click(screen.getByRole("button", { name: "Add motion" }));
    await user.click(screen.getByRole("radio", { name: "Appears" }));
    expect(tileNames()).toEqual(["Fade up", "Develop", "Pixelate", "Blur in", "Reveal", "Fade in"]);
    await user.click(within(tiles()).getByRole("radio", { name: "Develop" }));
    expect(saved.animations).toEqual([]);
    expect(saved.effects).toEqual([{ effect: "develop-reveal", params: { speed: 1 } }]);
  });
});
