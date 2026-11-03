import { findPreset } from "@lintel/motion/presets";
import type { MotionSpec } from "@lintel/motion";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { TriggerPicker } from "./TriggerPicker.js";

function Harness({ initial, onSpec }: { initial: MotionSpec; onSpec: (spec: MotionSpec) => void }) {
  const [spec, setSpec] = useState(initial);
  return (
    <TriggerPicker
      spec={spec}
      onChange={(next) => {
        setSpec(next);
        onSpec(next);
      }}
      onCommit={() => undefined}
    />
  );
}

describe("the trigger picker's scroll choices", () => {
  it("makes an in-view animation play backwards when people scroll back up past it", async () => {
    const user = userEvent.setup();
    let latest = findPreset("fade-up")!.spec;
    render(<Harness initial={latest} onSpec={(spec) => (latest = spec)} />);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Scrolling back up past it" }),
      "Plays backwards",
    );
    expect(latest.trigger).toMatchObject({
      type: "inView",
      actions: { enter: "play", leaveBack: "reverse" },
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Scrolling back up past it" }),
      "Stays as it is",
    );
    expect(latest.trigger).not.toHaveProperty("actions");
  });

  it("settles a scroll scene on steps", async () => {
    const user = userEvent.setup();
    let latest = findPreset("parallax-slow")!.spec;
    render(<Harness initial={latest} onSpec={(spec) => (latest = spec)} />);
    expect(screen.getByRole("slider", { name: "Follows the scrolling" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Settles on" }), "Thirds");
    expect(latest.trigger).toMatchObject({ type: "scroll", snap: [0, 1 / 3, 2 / 3, 1] });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Settles on" }),
      "Wherever scrolling stops",
    );
    expect(latest.trigger).not.toHaveProperty("snap");
  });
});
