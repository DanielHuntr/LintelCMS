import { createEmptyPage } from "@lintel/builder-model";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Blueprint } from "../content-types/blueprints.types.js";
import type { Collection, Entry } from "../content/content.types.js";
import { EntryEditor } from "../content/EntryEditor.js";
import { samplePost } from "../content/testEntries.js";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
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

function renderPageEditor(
  entry: Entry | undefined,
  options: Parameters<typeof renderScreen>[1] = { initialPath: "/content/pages/p1" },
) {
  return renderScreen(
    <EntryEditor
      collection={pagesCollection}
      blueprint={pageBlueprint}
      initialEntry={entry}
      onCreated={() => undefined}
    />,
    options,
  );
}

afterEach(() => vi.restoreAllMocks());

function designedPageAnswers({ url }: { url: URL }) {
  if (url.pathname.startsWith("/navigation/")) return notInMenu;
  if (url.pathname !== "/website/canvas") return { revisions: [] };
  return {
    stylesheet: "",
    bodyClassName: "lintel-site",
    headerHtml: "",
    footerHtml: "",
    baseUrl: "http://localhost:3000",
    motionScript: "",
  };
}

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
    const fields = screen
      .getAllByText(/^(Design|Summary)$/)
      .filter((element) => !element.closest("[role=radiogroup]"));
    expect(fields.map((element) => element.textContent)).toEqual(["Design", "Summary"]);
  });

  it("says what the Summary is for, in plain words", async () => {
    mockApi(({ url }) => (url.pathname.startsWith("/navigation/") ? notInMenu : { revisions: [] }));
    renderPageEditor(samplePage({}));

    expect(
      await screen.findByText(/It shows in search results, link previews and lists of pages/),
    ).toBeInTheDocument();
  });

  it("keeps the guided start to one row, with no picture pushing the fields down", async () => {
    mockApi(({ url }) => (url.pathname.startsWith("/navigation/") ? notInMenu : { revisions: [] }));
    renderPageEditor(samplePage({}));

    const card = await screen.findByRole("region", { name: "This page has no design yet" });
    expect(card.querySelector(".aspect-\\[16\\/9\\]")).toBeNull();
  });

  it("switches to the designer from the top bar", async () => {
    const user = userEvent.setup();
    mockApi(designedPageAnswers);
    const { router } = renderPageEditor(samplePage({ design: designWithOneSection() }));

    const views = await screen.findByRole("radiogroup", { name: /^Sections of/ });
    expect(within(views).getByRole("radio", { name: "Content" })).toBeChecked();
    await user.click(within(views).getByRole("radio", { name: "Design" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/content/pages/p1/design/design"),
    );
  });

  it("stays on the page, with the edit, when it can't be saved before Design", async () => {
    const user = userEvent.setup();
    let isDown = true;
    const { calls } = mockApi((request) => {
      if (request.method !== "GET" && request.url.pathname === "/entries/p1") {
        if (isDown) throw apiErrorResponse(500, "INTERNAL", "Broken");
        return samplePage({ design: designWithOneSection(), summary: "Fresh bread" });
      }
      return designedPageAnswers(request);
    });
    const { router } = renderPageEditor(samplePage({ design: designWithOneSection() }));

    const summary = await screen.findByRole("textbox", { name: "Summary" });
    await user.type(summary, "Fresh bread");
    const design = await screen.findByRole("radio", { name: "Design" });
    await user.click(design);

    expect(await screen.findByText(/couldn’t be saved, so you’re still here/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/content/pages/p1");
    expect(summary).toHaveValue("Fresh bread");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    isDown = false;
    await user.click(design);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/content/pages/p1/design/design"),
    );
    expect(
      calls.filter((call) => call.method !== "GET" && call.url.pathname === "/entries/p1").at(-1)
        ?.body,
    ).toMatchObject({ data: { summary: "Fresh bread" } });
  });

  it("saves once and moves once when Design is pressed twice", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi((request) =>
      request.method !== "GET" && request.url.pathname === "/entries/p1"
        ? samplePage({ design: designWithOneSection(), summary: "Rye" })
        : designedPageAnswers(request),
    );
    const { router } = renderPageEditor(samplePage({ design: designWithOneSection() }));

    await user.type(await screen.findByRole("textbox", { name: "Summary" }), "Rye");
    const design = await screen.findByRole("radio", { name: "Design" });
    const steps = router.history.length;
    await user.dblClick(design);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/content/pages/p1/design/design"),
    );
    expect(
      calls.filter((call) => call.method !== "GET" && call.url.pathname === "/entries/p1"),
    ).toHaveLength(1);
    expect(router.history.length).toBe(steps + 1);
  });

  it("calls Design 'On the page' for someone who can only change the content", async () => {
    mockApi(designedPageAnswers);
    renderPageEditor(samplePage({ design: designWithOneSection() }), {
      permissions: ["entries:*", "navigation:read"],
      initialPath: "/content/pages/p1",
    });

    const card = await screen.findByRole("region", { name: "Design" });
    expect(within(card).getByRole("link", { name: "Edit on the page" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "On the page" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Design" })).toBeNull();
  });

  it("offers no Design view until a new page exists", async () => {
    mockApi(({ url }) => (url.pathname.startsWith("/navigation/") ? notInMenu : { revisions: [] }));
    renderPageEditor(undefined);

    await screen.findByRole("button", { name: "Start designing" });
    expect(screen.queryByRole("radio", { name: "Design" })).toBeNull();
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
