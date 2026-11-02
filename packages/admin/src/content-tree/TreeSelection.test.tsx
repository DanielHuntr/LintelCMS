import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ContentSection } from "./ContentSection.js";
import { testNode } from "./testTree.js";
import { emptySelection, selectRange, toggleSelected } from "./treeSelection.js";

const home = testNode({ id: "home", title: "Home", childCount: 3, isSiteStart: true });
const about = testNode({ id: "about", title: "About", parentId: "home", childCount: 2 });
const team = testNode({ id: "team", title: "Team", parentId: "home" });
const contact = testNode({ id: "contact", title: "Contact", parentId: "home" });

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
      return url.searchParams.get("parentId") === "home"
        ? level([about, team, contact])
        : level([home]);
    }
    if (path.endsWith("/content-tree/bulk/summary")) {
      return {
        items: [
          { id: "about", title: "About", descendantCount: 2 },
          { id: "contact", title: "Contact", descendantCount: 0 },
        ],
        totalCount: 4,
      };
    }
    if (method === "POST" && path.endsWith("/content-tree/bulk")) {
      return { changed: ["about", "contact"], skipped: [], recycleBinItemIds: ["b1", "b2"] };
    }
    if (method === "POST" && path.includes("/recycle-bin/")) {
      return { entryId: "about", parentId: "home", restoredCount: 3 };
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

const editor = { permissions: ["entries:*"], initialPath: "/content" };
const row = (name: RegExp) => screen.findByRole("treeitem", { name });
const rowBox = (item: HTMLElement) => item.firstElementChild as HTMLElement;

describe("picking several pages in the tree", () => {
  it("toggles with Ctrl or ⌘, picks a run with Shift, and clears with Escape", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);
    const user = userEvent.setup();

    await user.keyboard("{Control>}");
    await user.click(rowBox(await row(/^About/)));
    await user.keyboard("{/Control}");
    expect(screen.getByText("1 selected")).toBeTruthy();

    await user.keyboard("{Shift>}");
    await user.click(rowBox(await row(/^Contact/)));
    await user.keyboard("{/Shift}");
    const toolbar = screen.getByRole("toolbar", { name: "Actions for the 3 selected" });
    expect(within(toolbar).getByText("3 selected")).toBeTruthy();
    expect((await row(/^Team/)).getAttribute("aria-selected")).toBe("true");
    expect((await row(/^Home/)).getAttribute("aria-selected")).toBe("false");

    await user.keyboard("{Meta>}");
    await user.click(rowBox(await row(/^Team/)));
    await user.keyboard("{/Meta}");
    expect(screen.getByText("2 selected")).toBeTruthy();

    (await row(/^About/)).focus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("toolbar")).toBeNull());
  });

  it("picks with Space and extends with Shift and the arrow keys", async () => {
    answerTree();
    renderScreen(<ContentSection />, editor);
    const user = userEvent.setup();

    (await row(/^About/)).focus();
    await user.keyboard(" ");
    expect(screen.getByText("1 selected")).toBeTruthy();
    await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
    expect(screen.getByText("3 selected")).toBeTruthy();
    expect(document.activeElement).toBe(await row(/^Contact/));
    await user.keyboard(" ");
    expect(screen.getByText("2 selected")).toBeTruthy();
  });

  it("deletes the picked pages after one question, then brings them back with Undo", async () => {
    const api = answerTree();
    renderScreen(<ContentSection />, editor);
    const user = userEvent.setup();

    await user.keyboard("{Control>}");
    await user.click(rowBox(await row(/^About/)));
    await user.click(rowBox(await row(/^Contact/)));
    await user.keyboard("{/Control}");
    await user.click(screen.getByRole("button", { name: "Delete…" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete 2 pages?" });
    expect(await within(dialog).findByText("and 2 pages inside")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Move to recycle bin" }));

    expect(await screen.findByText("Moved 2 pages to the recycle bin.")).toBeTruthy();
    expect(
      api.calls.find((call) => call.url.pathname.endsWith("/content-tree/bulk"))?.body,
    ).toEqual({ action: "recycle", entryIds: ["about", "contact"] });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Brought 2 pages back.")).toBeTruthy();
  });
});

describe("the selection's rules", () => {
  const visible = ["home", "about", "team", "contact"];

  it("runs from the anchor to the row, either way", () => {
    const picked = toggleSelected(emptySelection, "contact");
    expect([...selectRange(picked, "about", visible).ids]).toEqual(["about", "team", "contact"]);
    expect([...selectRange(emptySelection, "team", visible, "home").ids]).toEqual([
      "home",
      "about",
      "team",
    ]);
  });

  it("takes a row out when it is toggled again", () => {
    const once = toggleSelected(emptySelection, "about");
    expect(toggleSelected(once, "about").ids.size).toBe(0);
  });
});
