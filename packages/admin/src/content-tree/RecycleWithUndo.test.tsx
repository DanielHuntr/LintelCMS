import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ContentSection } from "./ContentSection.js";
import { testNode } from "./testTree.js";

const home = testNode({ id: "home", title: "Home", childCount: 1, isSiteStart: true });
const about = testNode({ id: "about", title: "About", parentId: "home" });

const roots = {
  sites: [{ id: "s1", name: "Default site", locale: "en-GB" }],
  site: { id: "s1", name: "Default site", locale: "en-GB" },
  locale: "en-GB",
  roots: [
    {
      handle: "pages",
      name: "Pages",
      blueprintHandle: "page",
      structure: "tree",
      childCount: 1,
      childrenAsCollection: false,
    },
  ],
  siteStartCount: 1,
  recycleBinCount: 0,
};

function answerTree() {
  return mockApi(({ method, url }) => {
    const path = url.pathname;
    const level = (items: unknown[]) => ({ items, total: items.length, offset: 0, limit: 100 });
    if (path.endsWith("/content-tree")) return roots;
    if (path.endsWith("/content-tree/children")) {
      return url.searchParams.get("parentId") === "home" ? level([about]) : level([home]);
    }
    if (method === "POST" && path.endsWith("/content-tree/entries/about/recycle")) {
      return { itemId: "b1", entryIds: ["about"] };
    }
    if (method === "POST" && path.endsWith("/recycle-bin/b1/restore")) {
      return { entryId: "about", parentId: "home", restoredCount: 1 };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
}

beforeEach(() =>
  window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","home"]'),
);
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("deleting a page from the tree", () => {
  it("says it went to the recycle bin and puts it back as it was on Undo", async () => {
    const api = answerTree();
    renderScreen(<ContentSection />, { permissions: ["entries:*"], initialPath: "/content" });

    const row = await screen.findByRole("treeitem", { name: /^About/ });
    fireEvent.contextMenu(row.firstElementChild ?? row);
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete…" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete “About”?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Move to recycle bin" }));

    const note = await screen.findByText("Moved “About” to the recycle bin.");
    expect(note.closest("[role=status]")).toHaveAttribute("aria-live", "polite");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));

    await screen.findByText("Brought “About” back.");
    const restore = api.calls.find((call) => call.url.pathname.endsWith("/restore"));
    expect(restore?.body).toEqual({ asBefore: true });
  });
});
