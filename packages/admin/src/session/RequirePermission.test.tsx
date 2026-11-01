import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { RequirePermission } from "./RequirePermission.js";

function SecretScreen() {
  return <h1>Webhooks</h1>;
}

describe("RequirePermission", () => {
  it("shows the screen to someone with the permission", async () => {
    renderScreen(
      <RequirePermission permission="settings:read">
        <SecretScreen />
      </RequirePermission>,
      { permissions: ["settings:*"] },
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Webhooks" })).toBeInTheDocument();
  });

  it("tells anyone else it isn't for them, without rendering the screen", async () => {
    renderScreen(
      <RequirePermission permission="settings:read">
        <SecretScreen />
      </RequirePermission>,
      { permissions: ["entries:*", "media:*"] },
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "You don’t have access to this" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Webhooks" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the dashboard" })).toHaveAttribute("href", "/");
  });
});
