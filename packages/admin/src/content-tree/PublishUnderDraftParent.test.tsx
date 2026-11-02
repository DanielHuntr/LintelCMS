import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ContentSection } from "./ContentSection.js";
import { testNode } from "./testTree.js";

/*
 * Publishing from the tree (the row's Publish… and the selection's Publish) asks the
 * editor's question when a page would go live under a page that isn't published
 * (LINTEL-LEFT-005 in docs/qa/FIX-LOG-leftovers.md).
 */

const draftParent = testNode({ id: "parent", title: "Services", childCount: 2 });
const design = testNode({ id: "design", title: "Design", parentId: "parent" });
const build = testNode({ id: "build", title: "Build", parentId: "parent" });

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
  siteStartCount: 0,
  recycleBinCount: 0,
};

function answerTree() {
  return mockApi(({ method, url, body }) => {
    const path = url.pathname;
    const level = (items: unknown[]) => ({ items, total: items.length, offset: 0, limit: 100 });
    if (path.endsWith("/content-tree")) return roots;
    if (path.endsWith("/content-tree/children")) {
      return url.searchParams.get("parentId") === "parent"
        ? level([design, build])
        : level([draftParent]);
    }
    if (path.endsWith("/info")) {
      return { unpublishedAncestors: [{ id: "parent", title: "Services" }] };
    }
    if (method === "POST" && path.endsWith("/content-tree/bulk")) {
      return { changed: (body as { entryIds: string[] }).entryIds, skipped: [] };
    }
    if (method === "POST" && path.endsWith("/publish")) {
      return { changed: [path.split("/").at(-2)], skipped: [] };
    }
    throw new Error(`Unexpected ${method} ${path}`);
  });
}

beforeEach(() =>
  window.localStorage.setItem("lintel.contentTree.expanded.main", '["root:pages","parent"]'),
);
afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const editor = { permissions: ["entries:*"], initialPath: "/content" };
const row = (name: RegExp) => screen.findByRole("treeitem", { name });
const rowBox = (item: HTMLElement) => item.firstElementChild as HTMLElement;
const published = (calls: ReturnType<typeof answerTree>["calls"]) =>
  calls
    .filter((call) => call.method === "POST")
    .map((call) => `${call.url.pathname} ${JSON.stringify(call.body)}`);

async function publishFromRowMenu() {
  fireEvent.contextMenu(rowBox(await row(/^Design/)));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Publish…" }));
  const confirm = await screen.findByRole("alertdialog");
  await userEvent.click(within(confirm).getByRole("button", { name: "Publish" }));
  return screen.findByRole("alertdialog", { name: "Its parent page isn’t published" });
}

describe("publishing from the tree under a page that isn't published", () => {
  it("asks first, and publishes the parent then the page when asked to", async () => {
    const { calls } = answerTree();
    renderScreen(<ContentSection />, editor);

    const question = await publishFromRowMenu();
    expect(question).toHaveTextContent("“Design” is under “Services”");
    await userEvent.click(
      within(question).getByRole("button", { name: "Publish with its parent" }),
    );

    expect(await screen.findByText("Done: 2 changed.")).toBeTruthy();
    expect(published(calls)).toEqual([
      '/content-tree/bulk {"action":"publish","entryIds":["parent"]}',
      '/content-tree/entries/design/publish {"includeDescendants":false}',
    ]);
  });

  it("publishes nothing after Cancel, and only the page after 'Publish this page only'", async () => {
    const { calls } = answerTree();
    renderScreen(<ContentSection />, editor);

    await userEvent.click(
      within(await publishFromRowMenu()).getByRole("button", { name: "Cancel" }),
    );
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(published(calls)).toEqual([]);

    const question = await publishFromRowMenu();
    await userEvent.click(within(question).getByRole("button", { name: "Publish this page only" }));
    expect(await screen.findByText("Done: 1 changed.")).toBeTruthy();
    expect(published(calls)).toEqual([
      '/content-tree/entries/design/publish {"includeDescendants":false}',
    ]);
  });

  it("asks once for a bulk Publish, then publishes the parent with the picked pages", async () => {
    const { calls } = answerTree();
    renderScreen(<ContentSection />, editor);
    const user = userEvent.setup();

    await user.keyboard("{Control>}");
    await user.click(rowBox(await row(/^Design/)));
    await user.click(rowBox(await row(/^Build/)));
    await user.keyboard("{/Control}");
    const toolbar = screen.getByRole("toolbar", { name: "Actions for the 2 selected" });
    await user.click(within(toolbar).getByRole("button", { name: "Publish" }));

    const question = await screen.findByRole("alertdialog", {
      name: "A page above them isn’t published",
    });
    expect(question).toHaveTextContent("2 of these pages are under “Services”");
    await user.click(
      within(question).getByRole("button", { name: "Publish with the page above them" }),
    );
    expect(await screen.findByText(/Published 3 pages/)).toBeTruthy();
    expect(published(calls)).toEqual([
      '/content-tree/bulk {"action":"publish","entryIds":["parent","design","build"]}',
    ]);
  });
});
