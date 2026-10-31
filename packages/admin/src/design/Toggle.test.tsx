import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Toggle } from "./Toggle.js";

function ToggleWithState({ startsOn = false }: { startsOn?: boolean }) {
  const [isOn, setIsOn] = useState(startsOn);
  return <Toggle label="Email me about orders" checked={isOn} onCheckedChange={setIsOn} />;
}

describe("Toggle", () => {
  it("is announced as a switch named by its visible label", () => {
    render(<ToggleWithState />);

    const toggle = screen.getByRole("switch", { name: "Email me about orders" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("turns on and off when clicked, or when its label is clicked", async () => {
    render(<ToggleWithState />);
    const toggle = screen.getByRole("switch");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByText("Email me about orders"));
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("works from the keyboard with Space", async () => {
    render(<ToggleWithState startsOn />);

    await userEvent.tab();
    await userEvent.keyboard(" ");

    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("keeps its name for screen readers when the label is hidden", () => {
    render(
      <Toggle
        label="Maintenance mode"
        labelVisibility="hidden"
        checked={false}
        onCheckedChange={() => undefined}
      />,
    );

    expect(screen.getByRole("switch", { name: "Maintenance mode" })).toBeInTheDocument();
    expect(screen.queryByText("Maintenance mode")).not.toBeInTheDocument();
  });
});
