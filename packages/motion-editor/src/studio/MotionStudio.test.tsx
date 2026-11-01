import type { MotionSpec } from "@lintel/motion";
import { findPreset } from "@lintel/motion/presets";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MotionStudio } from "./MotionStudio.js";

function renderStudio(initialSpec: MotionSpec | null = null, initialPresetId?: string) {
  const onChange = vi.fn();
  render(
    <MotionStudio
      initialSpec={initialSpec}
      initialPresetId={initialPresetId}
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

const lastSpec = (onChange: ReturnType<typeof vi.fn>): MotionSpec =>
  onChange.mock.calls.at(-1)?.[0];

describe("the animation studio", () => {
  it("starts on the gallery and picking a preset opens the simple panel", async () => {
    const { onChange, user } = renderStudio();
    await user.click(screen.getByRole("button", { name: /^Fade up/ }));
    expect(screen.getByRole("heading", { name: "Fade up" })).toBeInTheDocument();
    expect(lastSpec(onChange)).toEqual(findPreset("fade-up")!.spec);
    expect(onChange).toHaveBeenLastCalledWith(expect.anything(), "fade-up");
  });

  it("filters the gallery by kind and by search", async () => {
    const { user } = renderStudio();
    await user.click(screen.getByRole("radio", { name: "Hover" }));
    expect(screen.getByRole("button", { name: /^Magnetic/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Fade up/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search presets" }), "zzz");
    expect(screen.getByText(/No presets match/)).toBeInTheDocument();
  });

  it("explains what to do when there is no animation yet", async () => {
    const { user } = renderStudio();
    await user.click(screen.getByRole("radio", { name: "Simple" }));
    expect(screen.getByRole("heading", { name: "No animation yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Browse presets" }));
    expect(screen.getByRole("region", { name: "Animation presets" })).toBeInTheDocument();
  });

  it("makes it faster with the speed slider, and undo puts it back", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-up")!.spec, "fade-up");
    fireEvent.change(screen.getByRole("slider", { name: "Speed" }), { target: { value: "2" } });
    expect(lastSpec(onChange).duration).toBe(350);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(lastSpec(onChange).duration).toBe(700);
    screen.getByRole("slider", { name: "Speed" }).focus();
    await user.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(lastSpec(onChange).duration).toBe(350);
  });

  it("changes what starts it in plain words", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-up")!.spec, "fade-up");
    await user.selectOptions(screen.getByRole("combobox", { name: "Starts when" }), "load");
    expect(lastSpec(onChange).trigger).toEqual({ type: "load" });
    expect(screen.getByText("Plays as soon as the page has loaded.")).toBeInTheDocument();
  });

  it("moves a keyframe with the keyboard on the timeline", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-up")!.spec, "fade-up");
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    const keyframe = screen.getByRole("button", { name: /Keyframe 2 of 2 on Fade/ });
    keyframe.focus();
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(lastSpec(onChange).tracks[0]?.keyframes[1]?.offset).toBe(0.9);
    expect(screen.getByRole("heading", { name: "Fade: keyframe 2" })).toBeInTheDocument();
  });

  it("adds a track and a keyframe at the playhead, then edits its value", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-in")!.spec, "fade-in");
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Add a property" }), "blur");
    expect(lastSpec(onChange).tracks.map((track) => track.property)).toEqual(["opacity", "blur"]);
    const playhead = screen.getByRole("slider", { name: "Playhead" });
    playhead.focus();
    await user.keyboard("{Home}{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}");
    await user.click(
      screen.getByRole("button", { name: "Add a keyframe to Blur at the playhead" }),
    );
    expect(lastSpec(onChange).tracks[1]?.keyframes.map((keyframe) => keyframe.offset)).toEqual([
      0, 0.5, 1,
    ]);
    const value = screen.getByRole("textbox", { name: "Value (px)" });
    await user.clear(value);
    await user.type(value, "2");
    expect(lastSpec(onChange).tracks[1]?.keyframes[1]?.value).toBe(2);
  });

  it("warns instead of saving a spec that isn't valid", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-in")!.spec, "fade-in");
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    const calls = onChange.mock.calls.length;
    await user.selectOptions(screen.getByRole("combobox", { name: "Animate" }), "nodes");
    expect(screen.getByRole("status")).toHaveTextContent("can’t be saved yet");
    expect(onChange.mock.calls.length).toBe(calls);
  });

  it("edits easing curve handles by keyboard and shows springs' settling time", async () => {
    const { onChange, user } = renderStudio(findPreset("fade-in")!.spec, "fade-in");
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    const settings = screen.getByRole("heading", { name: "Easing", level: 3 }).parentElement!;
    await user.click(within(settings).getByRole("radio", { name: "Curve" }));
    const handle = within(settings).getByRole("slider", { name: "First curve handle" });
    handle.focus();
    await user.keyboard("{ArrowUp}");
    expect(lastSpec(onChange).easing).toEqual({
      type: "cubicBezier",
      x1: 0,
      y1: 0.01,
      x2: 0.58,
      y2: 1,
    });
    await user.click(within(settings).getByRole("radio", { name: "Spring" }));
    expect(within(settings).getByText(/Settles in \d+ ms/)).toBeInTheDocument();
    await user.click(within(settings).getByRole("button", { name: "Use this as the length" }));
    expect(lastSpec(onChange).duration).toBeGreaterThan(300);
  });

  it("edits a scroll scene's markers", async () => {
    const { onChange, user } = renderStudio(findPreset("parallax-slow")!.spec, "parallax-slow");
    await user.click(screen.getByRole("radio", { name: "Advanced" }));
    const start = screen.getByRole("group", { name: "Starts when" });
    fireEvent.change(
      within(start).getByRole("slider", { name: "Reaches this part of the screen" }),
      { target: { value: "0.5" } },
    );
    expect(lastSpec(onChange).trigger).toMatchObject({
      type: "scroll",
      start: { element: 0, viewport: 0.5 },
    });
    expect(screen.getByRole("img", { name: /starts at 50% down the screen/ })).toBeInTheDocument();
  });

  it("offers only the views the host allows", () => {
    render(
      <MotionStudio
        initialSpec={findPreset("fade-up")!.spec}
        initialPresetId="fade-up"
        initialView="advanced"
        views={["gallery", "simple"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: "Simple" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: "Advanced" })).not.toBeInTheDocument();
  });
});
