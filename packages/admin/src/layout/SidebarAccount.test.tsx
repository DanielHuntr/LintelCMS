import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { SidebarAccount } from "./SidebarAccount.js";

describe("SidebarAccount", () => {
  // LINTEL-A11Y-004: the link was named "Your account: Ada Lovelace" while it also shows the
  // email, so people using voice control couldn't say what they saw. The name now starts
  // from what's shown.
  it("names the account link by what it shows", async () => {
    renderScreen(
      <SidebarAccount signedInUser={{ name: "Ada Lovelace", email: "ada@example.com" }} />,
    );

    const link = await screen.findByRole("link", { name: /^Your account:/ });

    expect(link).toHaveAccessibleName("Your account: Ada Lovelace ada@example.com");
    expect(link).not.toHaveAttribute("aria-label");
  });
});
