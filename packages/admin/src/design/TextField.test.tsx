import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField.js";

describe("TextField", () => {
  it("reads its hint to screen readers", () => {
    render(<TextField label="Page title" hint="Shown in search results." />);

    const field = screen.getByLabelText("Page title");
    expect(field).toHaveAccessibleDescription("Shown in search results.");
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("shows an error in place of the hint and marks the field invalid", () => {
    render(
      <TextField
        label="Web address"
        hint="Starts with a slash."
        error="Another page already uses this address."
      />,
    );

    const field = screen.getByLabelText("Web address");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Another page already uses this address.");
    expect(screen.queryByText("Starts with a slash.")).not.toBeInTheDocument();
  });
});
