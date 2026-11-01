import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { HelpPage } from "./HelpPage.js";

describe("HelpPage", () => {
  it("lists every help topic", async () => {
    const openTopic = vi.fn();
    renderScreen(<HelpPage topic={undefined} onOpenTopic={openTopic} />);

    await userEvent.click(await screen.findByRole("button", { name: /Publishing and scheduling/ }));

    expect(screen.getByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    expect(openTopic).toHaveBeenCalledWith("using/publishing");
  });

  it("shows a topic with its headings under the page title", async () => {
    renderScreen(<HelpPage topic="using/publishing" onOpenTopic={() => undefined} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Publishing and scheduling" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Publishing later" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  it("shows the topic list for a topic that doesn't exist", async () => {
    renderScreen(<HelpPage topic="using/nothing" onOpenTopic={() => undefined} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Help" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Photos and files/ })).toBeVisible();
  });
});
