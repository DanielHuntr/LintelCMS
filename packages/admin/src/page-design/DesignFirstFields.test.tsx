import { createEmptyPage } from "@lintel/builder-model";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Blueprint } from "../content-types/blueprints.types.js";
import type { Collection, Entry } from "../content/content.types.js";
import { EntryEditor } from "../content/EntryEditor.js";
import { samplePost } from "../content/testEntries.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";

const pagesCollection: Collection = {
  id: "c1",
  handle: "pages",
  name: "Pages",
  blueprintHandle: "page",
  structure: "tree",
  routePattern: "/{slug}",
  allowedAtRoot: true,
  allowedChildren: ["pages"],
  childrenAsCollection: false,
  previewUrlPattern: null,
  entryCount: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
};

/** The Page blueprint of a site made before page designs: Page sections, then Design. */
const pageBlueprint: Blueprint = {
  id: "b1",
  handle: "page",
  name: "Page",
  kind: "entry",
  version: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
  fields: [
    { handle: "title", label: "Title", type: "text", required: true, options: {} },
    { handle: "summary", label: "Summary", type: "textarea", required: false, options: {} },
    {
      handle: "sections",
      label: "Page sections",
      type: "blocks",
      required: false,
      options: {
        blockTypes: [
          {
            handle: "faq",
            name: "FAQ",
            description: "",
            fields: [
              { handle: "question", label: "Question", type: "text", required: true, options: {} },
            ],
          },
        ],
      },
    },
    { handle: "design", label: "Design", type: "page", required: false, options: {} },
  ],
};

function designWithOneSection() {
  const page = createEmptyPage();
  return {
    ...page,
    root: {
      ...page.root,
      children: [
        {
          id: "s1",
          type: "section",
          name: "Welcome",
          props: {},
          styles: { base: {} },
          children: [],
        },
      ],
    },
  };
}

function samplePage(data: Record<string, unknown>): Entry {
  return samplePost({
    id: "p1",
    title: "Home",
    slug: "home",
    collectionHandle: "pages",
    blueprint: pageBlueprint,
    data: { title: "Home", summary: "", sections: null, design: null, ...data },
  });
}

function renderPageEditor(entry: Entry | undefined) {
  return renderScreen(
    <EntryEditor
      collection={pagesCollection}
      blueprint={pageBlueprint}
      initialEntry={entry}
      onCreated={() => undefined}
    />,
  );
}

afterEach(() => vi.restoreAllMocks());

// A saved page's side panel asks whether it's in the main menu.
const notInMenu = {
  menu: { handle: "main", name: "Main menu", source: "items" },
  inMenu: false,
  label: "",
};

describe("a page's editor", () => {
  it("leads with a picture of the design and Edit design, and hides Page sections", async () => {
    mockApi(({ url }) =>
      url.pathname.startsWith("/navigation/")
        ? notInMenu
        : url.pathname === "/website/canvas"
          ? {
              stylesheet: ".lintel-site { color: #222; }",
              bodyClassName: "lintel-site",
              headerHtml: '<header class="lintel-header">Corner Bakery</header>',
              footerHtml: "",
              baseUrl: "http://localhost:3000",
              motionScript: "",
            }
          : { revisions: [] },
    );
    renderPageEditor(samplePage({ design: designWithOneSection() }));

    const card = await screen.findByRole("region", { name: "Design" });
    expect(within(card).getByText("1 section on this page")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Edit design" })).toHaveAttribute(
      "href",
      "/content/pages/p1/design/design",
    );
    expect(screen.queryByText("Page sections")).not.toBeInTheDocument();
    // In a narrow column the heading kept one word per line beside the button: the words
    // now keep a sensible width, so the button wraps below them instead (QA sweep).
    const heading = within(card).getByRole("heading", { name: "Design" });
    expect(heading.parentElement?.className).toContain("flex-[1_1_14rem]");
    expect(screen.queryByRole("button", { name: /Simple sections/ })).not.toBeInTheDocument();
    // The picture is the page drawn with the website's look, in a frame without scripts.
    await waitFor(() => expect(card.querySelector("iframe")).not.toBeNull());
    const picture = card.querySelector("iframe") as HTMLIFrameElement;
    expect(picture.getAttribute("sandbox")).toBe("");
    expect(picture.getAttribute("srcdoc")).toContain("Corner Bakery");
    expect(picture.getAttribute("srcdoc")).toContain('<section class="welcome"></section>');
    const fields = screen.getAllByText(/^(Design|Summary)$/);
    expect(fields.map((element) => element.textContent)).toEqual(["Design", "Summary"]);
  });

  it("offers templates and sections for an empty design, with simple sections folded away", async () => {
    const user = userEvent.setup();
    mockApi(({ url }) => (url.pathname.startsWith("/navigation/") ? notInMenu : { revisions: [] }));
    renderPageEditor(
      samplePage({ sections: [{ id: "f1", type: "faq", data: { question: "Do you deliver?" } }] }),
    );

    const card = await screen.findByRole("region", { name: "This page has no design yet" });
    expect(
      within(card).getByRole("link", { name: "Start from a template or section" }),
    ).toHaveAttribute("href", "/content/pages/p1/design/design");

    const simple = screen.getByRole("button", { name: /Simple sections \(no design\)/ });
    expect(simple).toHaveAttribute("aria-expanded", "false");
    expect(simple).toHaveTextContent("1 section");
    expect(screen.queryByText("Page sections")).not.toBeInTheDocument();
    await user.click(simple);
    expect(simple).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Page sections" })).toBeInTheDocument();
  });

  it("saves a new page once it has a title, then opens it in the builder", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method }) => {
      if (method === "POST") return samplePage({ title: "About us" });
      return { revisions: [] };
    });
    const { router } = renderPageEditor(undefined);

    const start = await screen.findByRole("button", { name: "Start designing" });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription(/Give the page a title/);

    await user.type(screen.getByRole("textbox", { name: "Title" }), "About us{Enter}");
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/content/pages/p1/design/design"),
    );
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
  });
});
