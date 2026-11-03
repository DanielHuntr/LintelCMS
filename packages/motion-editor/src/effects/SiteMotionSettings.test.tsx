import { defaultSiteEffectSettings, type SiteEffectSettings } from "@lintel/motion/effects";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SiteMotionSettings } from "./SiteMotionSettings.js";

function Harness({
  initial,
  onSettings,
}: {
  initial: SiteEffectSettings;
  onSettings: (settings: SiteEffectSettings) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SiteMotionSettings
      value={value}
      onChange={(next) => {
        setValue(next);
        onSettings(next);
      }}
    />
  );
}

describe("the site's motion settings", () => {
  it("switch smooth scrolling on with one choice, saying what it does only once it's on", async () => {
    const user = userEvent.setup();
    let latest = defaultSiteEffectSettings;
    render(<Harness initial={latest} onSettings={(settings) => (latest = settings)} />);
    const group = screen.getByRole("radiogroup", { name: "Smooth scrolling" });
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(/glides to a stop/)).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Gentle" }));
    expect(latest.smoothScroll.strength).toBe("gentle");
    expect(screen.getByText(/glides to a stop/)).toBeInTheDocument();
    expect(group).toBeInTheDocument();
  });

  it("read settings saved before smooth scrolling existed as off", () => {
    const older: Partial<SiteEffectSettings> = { ...defaultSiteEffectSettings };
    delete older.smoothScroll;
    render(<Harness initial={older as SiteEffectSettings} onSettings={() => undefined} />);
    expect(screen.getByRole("radio", { name: "Off" })).toHaveAttribute("aria-checked", "true");
  });

  it("colour the cursor from the theme, offering a colour well only for a picked colour", async () => {
    const user = userEvent.setup();
    let latest: SiteEffectSettings = {
      ...defaultSiteEffectSettings,
      cursor: { ...defaultSiteEffectSettings.cursor, style: "ring" },
    };
    render(<Harness initial={latest} onSettings={(settings) => (latest = settings)} />);
    const colour = screen.getByRole("combobox", { name: "Cursor colour" });
    expect(colour).toHaveValue("text");
    expect(screen.queryByLabelText("Your colour")).toBeNull();
    await user.selectOptions(colour, "brand");
    expect(latest.cursor.colour).toBe("brand");
    await user.selectOptions(colour, "own");
    expect(latest.cursor.colour).toBe("#111111");
    expect(screen.getByLabelText("Your colour")).toBeInTheDocument();
  });
});
