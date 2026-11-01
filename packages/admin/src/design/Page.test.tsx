import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { autoFillGrid, Page } from "./Page.js";

describe("Page", () => {
  it("is fluid up to 1440px for overviews and one 720px column for forms", () => {
    render(
      <>
        <Page width="wide">Overview</Page>
        <Page width="readable">Form</Page>
      </>,
    );
    expect(screen.getByText("Overview")).toHaveClass("w-full", "max-w-[90rem]");
    expect(screen.getByText("Form")).toHaveClass("w-full", "max-w-[45rem]");
    // Neither is centred: both start next to the sidebar.
    expect(screen.getByText("Form")).not.toHaveClass("mx-auto");
  });

  it("fills grid rows with as many cards as fit", () => {
    expect(autoFillGrid()).toContain("minmax(min(100%,17.5rem),1fr)");
    expect(autoFillGrid("tile")).toContain("auto-fill");
  });
});
