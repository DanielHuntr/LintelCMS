import { defaultSiteEffectSettings, type SiteEffectSettings } from "@lintel/motion/effects";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { SiteMotionSettings, type CursorPicturePicker } from "./SiteMotionSettings.js";

function Harness({
  initial,
  onSettings,
  pickPicture,
}: {
  initial: SiteEffectSettings;
  onSettings: (settings: SiteEffectSettings) => void;
  pickPicture?: CursorPicturePicker;
}) {
  const [value, setValue] = useState(initial);
  return (
    <SiteMotionSettings
      value={value}
      pickPicture={pickPicture}
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
    let latest: SiteEffectSettings = defaultSiteEffectSettings;
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

  it("use a picture from the media library as the cursor, with its size and point", async () => {
    const user = userEvent.setup();
    let latest: SiteEffectSettings = defaultSiteEffectSettings;
    const pickPicture: CursorPicturePicker = async () => ({
      assetId: "arrow",
      src: "https://cms.test/api/media/arrow/file?v=1",
      bytes: 90 * 1024,
    });
    render(
      <Harness
        initial={latest}
        pickPicture={pickPicture}
        onSettings={(settings) => (latest = settings)}
      />,
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Cursor" }), "picture");
    // No picture yet: the normal pointer stays, and only the button to choose one shows.
    expect(screen.getByText(/Until there is one/)).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: /Picture size/ })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Trail" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Choose a picture" }));
    expect(latest.cursor.picture).toMatchObject({
      assetId: "arrow",
      src: "https://cms.test/api/media/arrow/file?v=1",
      bytes: 90 * 1024,
    });
    expect(await screen.findByText(/This picture is 90 kB/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Top-left corner" }));
    expect(latest.cursor.picture?.point).toBe("top-left");
    fireEvent.change(screen.getByRole("slider", { name: /Picture size/ }), {
      target: { value: "48" },
    });
    expect(latest.cursor.picture?.size).toBe(48);
  });

  it("change the word's look under a closed group, and show it in the preview", async () => {
    const user = userEvent.setup();
    let latest: SiteEffectSettings = {
      ...defaultSiteEffectSettings,
      cursor: { ...defaultSiteEffectSettings.cursor, style: "ring" },
    };
    render(<Harness initial={latest} onSettings={(settings) => (latest = settings)} />);
    const group = screen.getByRole("button", { name: /The cursor's word/ });
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(group).toHaveTextContent("Standard");
    await user.click(group);
    const background = screen.getByRole("group", { name: /Background/ });
    await user.click(within(background).getByRole("button", { name: "Brand" }));
    await user.click(screen.getByRole("radio", { name: "Circle" }));
    await user.click(screen.getByRole("radio", { name: "Large" }));
    expect(latest.cursor.word).toEqual({
      background: "var(--lintel-color-brand)",
      colour: "auto",
      size: "large",
      shape: "circle",
    });
    // Moving over the sample card shows the word, in that look.
    const preview = screen.getByTestId("cursor-preview");
    fireEvent.pointerMove(screen.getByText("Project"), {
      pointerType: "mouse",
      clientX: 40,
      clientY: 40,
    });
    const word = screen.getByTestId("cursor-preview-word");
    expect(word).toHaveTextContent("View");
    expect(word.style.getPropertyValue("--lintel-cursor-word-background")).toBe(
      "var(--lintel-color-brand, #111111)",
    );
    expect(word.style.getPropertyValue("--lintel-cursor-word-radius")).toBe("50%");
    fireEvent.pointerLeave(preview);
    expect(screen.queryByTestId("cursor-preview-word")).toBeNull();
  });

  it("show the cursor's trail in the preview, but not behind a picture", () => {
    const withTrail = {
      ...defaultSiteEffectSettings,
      cursor: {
        ...defaultSiteEffectSettings.cursor,
        style: "dot" as const,
        trail: "comet" as const,
      },
    };
    const { unmount } = render(<Harness initial={withTrail} onSettings={() => undefined} />);
    expect(screen.getByTestId("cursor-preview-trail")).toHaveAttribute("data-trail", "comet");
    unmount();

    const picture = { ...withTrail, cursor: { ...withTrail.cursor, style: "picture" as const } };
    render(<Harness initial={picture} onSettings={() => undefined} />);
    expect(screen.queryByTestId("cursor-preview-trail")).toBeNull();
  });

  it("read cursor settings saved before the word had a look", () => {
    const older = {
      ...defaultSiteEffectSettings,
      cursor: { style: "ring" as const, trail: "none" as const, colour: "text", size: 32 },
    };
    render(<Harness initial={older} onSettings={() => undefined} />);
    expect(screen.getByRole("button", { name: /The cursor's word/ })).toHaveTextContent("Standard");
  });
});
