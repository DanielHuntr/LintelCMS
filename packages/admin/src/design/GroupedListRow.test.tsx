import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { GroupedList } from "./GroupedList.js";
import { GroupedListRow } from "./GroupedListRow.js";

/** Links need a router, so this renders the list as the only page of a small in-memory one. */
async function renderInRouter(list: ReactNode) {
  const rootRoute = createRootRoute({ component: () => list });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole("list");
}

describe("GroupedListRow", () => {
  it("links to another screen when given `to`", async () => {
    await renderInRouter(
      <GroupedList header="Site">
        <GroupedListRow label="Domains" to="/settings/domains" />
      </GroupedList>,
    );

    expect(screen.getByRole("list", { name: "Site" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Domains" })).toHaveAttribute(
      "href",
      "/settings/domains",
    );
  });

  it("is a button that calls onSelect when given one", async () => {
    const openLanguagePicker = vi.fn();
    render(
      <GroupedList>
        <GroupedListRow label="Language" detail="English" onSelect={openLanguagePicker} />
      </GroupedList>,
    );

    await userEvent.click(screen.getByRole("button", { name: /Language/ }));

    expect(openLanguagePicker).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toHaveTextContent("English");
  });

  it("is plain text with its accessory when it doesn't navigate", () => {
    render(
      <GroupedList>
        <GroupedListRow
          label="Maintenance mode"
          description="Visitors see a holding page"
          accessory={<input type="checkbox" aria-label="Maintenance mode" />}
        />
      </GroupedList>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Visitors see a holding page")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Maintenance mode" })).toBeInTheDocument();
  });
});
