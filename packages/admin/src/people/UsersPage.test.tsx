import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { canGrantRole } from "./grantableRoles.js";
import type { Person } from "./people.api.js";
import { ed, editorRole, invitation, ownerRole, shopRole, viewerRole, you } from "./testPeople.js";
import { UsersPage } from "./UsersPage.js";

function servePeople(people: Person[] = [you, ed]) {
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/users" && method === "GET") {
      const search = url.searchParams.get("search") ?? "";
      return {
        users: people.filter((person) => person.name.toLowerCase().includes(search.toLowerCase())),
      };
    }
    if (url.pathname === "/invitations" && method === "GET") return { invitations: [invitation] };
    if (url.pathname === "/roles") return { roles: [ownerRole, editorRole, viewerRole, shopRole] };
    if (url.pathname === "/invitations" && method === "POST") {
      const { email } = body as { email: string };
      if (email === "ed@example.com") {
        throw apiErrorResponse(
          409,
          "EMAIL_ALREADY_USED",
          "There is already an account with the email ed@example.com.",
        );
      }
      return {
        invitation: { ...invitation, email },
        invitationUrl: "http://localhost:5173/accept-invitation#token=abc",
      };
    }
    if (url.pathname === "/users/u2/role")
      return { ...ed, roles: [{ id: "r-viewer", name: "Viewer", handle: "viewer" }] };
    if (url.pathname === "/users/u1/role") {
      throw apiErrorResponse(
        409,
        "LAST_OWNER",
        "This is the only active owner, so you can't change their role.",
      );
    }
    if (url.pathname === "/users/u2/deactivate") return { ...ed, status: "deactivated" };
    if (url.pathname === "/users/u2" && method === "DELETE") return undefined;
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("the Users screen", () => {
  it("lists people with their roles, and the invitations still waiting", async () => {
    servePeople();
    renderScreen(<UsersPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "People" });
    expect(within(list).getByText("Ada Lovelace (you)")).toBeInTheDocument();
    expect(within(list).getByText("Ed Editor")).toBeInTheDocument();
    expect(within(list).getByText(/Hasn’t signed in yet/)).toBeInTheDocument();
    expect(
      within(list).getByRole("img", { name: "Two-factor authentication is on" }),
    ).toBeInTheDocument();
    const invitations = screen.getByRole("list", { name: "Invitations" });
    expect(within(invitations).getByText("nia@example.com")).toBeInTheDocument();
  });

  // "It's just you so far" sat under a pending invitation, as if nobody had been asked.
  it("mentions the invitation waiting when it's only you so far", async () => {
    servePeople([you]);
    renderScreen(<UsersPage />);
    expect(
      await screen.findByText("Just you for now, with one invitation waiting to be accepted."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/It’s just you so far/)).toBeNull();
  });

  it("searches by name", async () => {
    servePeople();
    renderScreen(<UsersPage />);

    await userEvent.type(await screen.findByLabelText("Search by name or email"), "ed");

    await waitFor(() => expect(screen.queryByText("Ada Lovelace (you)")).not.toBeInTheDocument());
    expect(screen.getByText("Ed Editor")).toBeInTheDocument();
  });

  it("invites someone and shows the link to pass on by hand", async () => {
    const { calls } = servePeople();
    renderScreen(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Invite someone" }));
    const dialog = screen.getByRole("dialog", { name: "Invite someone" });
    expect(within(dialog).getByLabelText("Role")).toHaveValue("r-editor");
    await userEvent.type(within(dialog).getByLabelText("Their email address"), "sam@example.com");
    await userEvent.selectOptions(within(dialog).getByLabelText("Role"), "Viewer");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    const sent = await screen.findByRole("dialog", { name: "Invitation sent" });
    expect(
      within(sent).getByText("http://localhost:5173/accept-invitation#token=abc"),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      email: "sam@example.com",
      roleId: "r-viewer",
    });
  });

  it("explains why an invitation couldn't be sent", async () => {
    servePeople();
    renderScreen(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Invite someone" }));
    const dialog = screen.getByRole("dialog", { name: "Invite someone" });
    await userEvent.type(within(dialog).getByLabelText("Their email address"), "ed@example.com");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    expect(
      await within(dialog).findByText(/already an account with the email ed@example.com/),
    ).toBeInTheDocument();
  });

  it("changes someone's role, and says why the last owner can't be changed", async () => {
    const { calls } = servePeople();
    renderScreen(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Ed Editor/ }));
    let sheet = screen.getByRole("dialog", { name: "Ed Editor" });
    await userEvent.selectOptions(within(sheet).getByLabelText("Role"), "Viewer");
    await userEvent.click(within(sheet).getByRole("button", { name: "Change role" }));
    await waitFor(() =>
      expect(calls.some((call) => call.url.pathname === "/users/u2/role")).toBe(true),
    );
    await userEvent.click(within(sheet).getByRole("button", { name: "Done" }));

    await userEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));
    sheet = screen.getByRole("dialog", { name: "Ada Lovelace" });
    expect(within(sheet).queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
    await userEvent.selectOptions(within(sheet).getByLabelText("Role"), "Editor");
    await userEvent.click(within(sheet).getByRole("button", { name: "Change role" }));
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("only active owner");
  });

  it("asks who gets someone's content before removing them", async () => {
    const { calls } = servePeople();
    renderScreen(<UsersPage />);

    await userEvent.click(await screen.findByRole("button", { name: /Ed Editor/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remove…" }));
    const confirm = screen.getByRole("dialog", { name: "Remove Ed Editor?" });
    expect(within(confirm).getByLabelText("Give their content to")).toHaveValue("u1");
    await userEvent.click(within(confirm).getByRole("button", { name: "Remove for good" }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === "DELETE")?.body).toEqual({
        reassignToUserId: "u1",
      }),
    );
  });

  it("hides inviting from people who can't invite", async () => {
    servePeople();
    renderScreen(<UsersPage />, { permissions: ["users:read"] });

    await screen.findByText("Ed Editor");
    expect(screen.queryByRole("button", { name: "Invite someone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resend/ })).not.toBeInTheDocument();
  });
});

describe("which roles someone may give", () => {
  it("needs everything the role allows, and only owners give Owner", () => {
    expect(canGrantRole(ownerRole, ["*"])).toBe(true);
    expect(canGrantRole(ownerRole, ["entries:*", "users:*"])).toBe(false);
    expect(canGrantRole(editorRole, ["entries:*", "media:*", "users:*"])).toBe(true);
    expect(canGrantRole(viewerRole, ["entries:*", "media:read"])).toBe(true);
    expect(canGrantRole(editorRole, ["entries:read", "media:read"])).toBe(false);
  });

  it("opens the invitation straight away when the command palette asks", async () => {
    servePeople();
    const onInvitingStarted = vi.fn();
    renderScreen(<UsersPage startInviting onInvitingStarted={onInvitingStarted} />);

    const dialog = await screen.findByRole("dialog", { name: "Invite someone" });
    expect(await within(dialog).findByLabelText("Their email address")).toBeInTheDocument();
    expect(onInvitingStarted).toHaveBeenCalledOnce();
  });

  it("doesn't open the invitation for someone who can't invite", async () => {
    servePeople();
    renderScreen(<UsersPage startInviting />, { permissions: ["users:read"] });

    expect(await screen.findByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Invite someone" })).not.toBeInTheDocument();
  });
});
