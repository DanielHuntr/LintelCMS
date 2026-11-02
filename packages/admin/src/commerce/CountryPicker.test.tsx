import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { allCountries, CountryPicker } from "./CountryPicker.js";

describe("the country picker", () => {
  // Retired codes made "United Kingdom" (GB and UK) and others show twice.
  it("lists each country once, by its ISO code", () => {
    render(<CountryPicker legend="Countries" value={[]} onChange={vi.fn()} />);

    expect(screen.getAllByRole("checkbox", { name: "United Kingdom" })).toHaveLength(1);
    const codes = allCountries().map((country) => country.code);
    expect(codes).toContain("GB");
    expect(codes).not.toContain("UK");
    expect(new Set(allCountries().map((country) => country.name)).size).toBe(codes.length);
  });
});
