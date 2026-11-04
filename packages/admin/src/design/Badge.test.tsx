import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./Badge.js";

describe("a warning badge", () => {
  it("darkens its words beyond the plain warning colour, for contrast (LINTEL-A11Y-039)", () => {
    render(<Badge tone="warning">Not connected</Badge>);
    expect(screen.getByText("Not connected").className).toContain("color-mix");
  });
});
