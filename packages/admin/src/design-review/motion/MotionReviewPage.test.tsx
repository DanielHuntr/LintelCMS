import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../../testing/renderScreen.js";
import { MotionReviewPage } from "./MotionReviewPage.js";

describe("the animation studio review page", () => {
  it("shows the studio in the admin's words, and the spec it is editing", async () => {
    renderScreen(<MotionReviewPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Animation studio" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fade up" })).toBeInTheDocument();
    expect(screen.getByText(/"translateY"/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: "Presets" }));
    await user.click(screen.getByRole("button", { name: /^Blur in/ }));
    expect(screen.getByText(/"blur"/)).toBeInTheDocument();
  });

  it("puts presets on real elements down the page", async () => {
    renderScreen(<MotionReviewPage />);
    expect(
      await screen.findByRole("heading", { name: "Presets on real elements" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Words rise")).toBeInTheDocument();
    expect(screen.getByText("Magnetic")).toBeInTheDocument();
  });
});
