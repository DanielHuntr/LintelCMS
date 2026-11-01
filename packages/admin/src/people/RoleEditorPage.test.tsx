import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { PermissionGroup } from "./people.api.js";
import { RoleEditorPage } from "./RoleEditorPage.js";
import { editorRole, ownerRole, shopRole } from "./testPeople.js";

const groups: PermissionGroup[] = [
  {
    id: "content",
    name: "Content",
    description: "Pages, posts and every other entry.",
    permissions: [
      { permission: "entries:read", name: "See content", description: "Including drafts." },
      { permission: "entries:update", name: "Edit anyone's content", description: "" },
    ],
  },
  {
    id: "plugin-commerce",
    name: "Online shop",
    description: "Products, orders and payments.",
    pluginId: "commerce",
    permissions: [{ permission: "commerce:read", name: "See the shop", description: "" }],
  },
];

function serveRoles() {
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/roles" && method === "GET")
      return { roles: [ownerRole, editorRole, shopRole] };
    if (url.pathname === "/permissions") return { groups };
    if (url.pathname.startsWith("/roles/") && method === "PATCH")
      return { ...shopRole, ...(body as object) };
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("the role editor", () => {
  it("shows permissions in words, grouped by area, with plugin groups marked", async () => {
    serveRoles();
    renderScreen(<RoleEditorPage roleId="r-shop" />);

    expect(await screen.findByRole("switch", { name: "See content" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Edit anyone's content" })).not.toBeChecked();
    expect(screen.getByText("Online shop (plugin)")).toBeInTheDocument();
    expect(screen.queryByText("entries:read")).not.toBeInTheDocument();
  });

  it("saves the permissions chosen for a custom role", async () => {
    const { calls } = serveRoles();
    renderScreen(<RoleEditorPage roleId="r-shop" />);

    await userEvent.click(await screen.findByRole("switch", { name: "See the shop" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Require two-factor authentication" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
        name: "Shop manager",
        description: "Runs the shop",
        permissions: ["entries:read", "commerce:read"],
        requiresTwoFactor: true,
      }),
    );
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("shows a built-in role's permissions without letting them change, but allows two-factor", async () => {
    const { calls } = serveRoles();
    renderScreen(<RoleEditorPage roleId="r-editor" />);

    expect(await screen.findByRole("switch", { name: "Edit anyone's content" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Edit anyone's content" })).toBeChecked();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("switch", { name: "Require two-factor authentication" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
        requiresTwoFactor: true,
      }),
    );
  });
});
