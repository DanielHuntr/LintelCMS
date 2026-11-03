import {
  createCountingNodeIds,
  createEmptyPage,
  type DraftPlan,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "../PageBuilder.js";
import { createMemoryPreferenceStore } from "../preferences/builder-preferences.js";
import { type PageDrafting, PageDraftingContext } from "./page-drafting.js";
import { RewriteText } from "./RewriteText.js";

const plan: DraftPlan = {
  sections: [
    { kind: "welcome", heading: "Bread worth waking for", text: "Baked at dawn.", button: "Visit" },
    { kind: "call-to-action", heading: "Hungry?", text: "Come by today.", button: "Find us" },
  ],
};

function stubDrafting(overrides: Partial<PageDrafting> = {}): PageDrafting {
  return {
    isReady: true,
    draftPage: vi.fn(async () => plan),
    rewrite: vi.fn(async () => "Shorter words."),
    ...overrides,
  };
}

function renderBuilder(document: PageDocument, pageDrafting?: PageDrafting) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={false}
      createId={createCountingNodeIds("new")}
      preferences={createMemoryPreferenceStore({ tourSeen: "yes", skillLevel: "designer" })}
      pageDrafting={pageDrafting}
    />,
  );
  return { latest: () => onChange.mock.lastCall?.[0] as PageDocument };
}

describe("drafting a page", () => {
  it("isn't offered without page drafting", () => {
    renderBuilder(createEmptyPage());
    expect(screen.queryByRole("button", { name: "Draft a page for me" })).not.toBeInTheDocument();
  });

  it("drafts from the form and adds the sections as one change that Undo takes back", async () => {
    const user = userEvent.setup();
    const drafting = stubDrafting();
    const { latest } = renderBuilder(createEmptyPage(), drafting);
    await user.click(screen.getByRole("button", { name: "Draft a page for me" }));
    const dialog = screen.getByRole("dialog", { name: "Draft a page" });
    expect(within(dialog).getByText(/check|Read the drafted words/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("What is this page for?"), "A bakery home page");
    await user.click(within(dialog).getByRole("button", { name: "Prices" }));
    await user.click(within(dialog).getByRole("button", { name: "Draft page" }));

    expect(drafting.draftPage).toHaveBeenCalledWith(
      {
        purpose: "A bakery home page",
        audience: "",
        tone: "friendly",
        sections: ["welcome", "features", "story", "prices", "call-to-action"],
      },
      expect.anything(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const sections = latest().root.children;
    expect(sections.map((section) => section.name)).toEqual(["Hero", "Call to action"]);

    await user.click(screen.getByRole("button", { name: /Undo/ }));
    expect(latest().root.children).toEqual([]);
  });

  it("can be stopped while it writes, adding nothing", async () => {
    const user = userEvent.setup();
    const drafting = stubDrafting({
      draftPage: (_request, watch) =>
        new Promise((_resolve, reject) => {
          watch.onProgress(0.3);
          watch.signal.addEventListener("abort", () => reject(new Error("Stopped")));
        }),
    });
    const { latest } = renderBuilder(createEmptyPage(), drafting);
    await user.click(screen.getByRole("button", { name: "Draft a page for me" }));
    await user.type(screen.getByLabelText("What is this page for?"), "A bakery");
    await user.click(screen.getByRole("button", { name: "Draft page" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
    expect(screen.getByText("This can take a minute or two.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(latest()).toBeUndefined();
  });

  it("shows the problem and keeps the form when a draft fails", async () => {
    const user = userEvent.setup();
    const drafting = stubDrafting({
      draftPage: async () => {
        throw new Error("Someone on this site is drafting right now.");
      },
    });
    renderBuilder(createEmptyPage(), drafting);
    await user.click(screen.getByRole("button", { name: "Draft a page for me" }));
    await user.type(screen.getByLabelText("What is this page for?"), "A bakery");
    await user.click(screen.getByRole("button", { name: "Draft page" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Someone on this site is drafting");
    expect(screen.getByLabelText("What is this page for?")).toHaveValue("A bakery");
  });

  it("says where to set it up when the model isn't installed", async () => {
    const user = userEvent.setup();
    renderBuilder(createEmptyPage(), stubDrafting({ isReady: false }));
    await user.click(screen.getByRole("button", { name: "Draft a page for me" }));
    expect(screen.getByText(/Settings → Page drafting/)).toBeInTheDocument();
  });
});

describe("rewriting a text", () => {
  const node = {
    id: "t1",
    type: "text",
    name: "",
    props: { text: "We bake fresh bread every day." },
    children: [],
  };

  it("puts the rewritten words in place", async () => {
    const user = userEvent.setup();
    const drafting = stubDrafting();
    const onRewrite = vi.fn();
    render(
      <PageDraftingContext value={drafting}>
        <RewriteText node={node as unknown as PageNode} isLocked={false} onRewrite={onRewrite} />
      </PageDraftingContext>,
    );
    await user.click(screen.getByRole("button", { name: "Shorter" }));
    expect(drafting.rewrite).toHaveBeenCalledWith(
      { text: "We bake fresh bread every day.", style: "shorter" },
      expect.anything(),
    );
    expect(onRewrite).toHaveBeenCalledWith("Shorter words.");
    expect(screen.getByText(/Undo puts the old words back/)).toBeInTheDocument();
  });

  it("isn't offered until the model is installed", () => {
    render(
      <PageDraftingContext value={stubDrafting({ isReady: false })}>
        <RewriteText node={node as unknown as PageNode} isLocked={false} onRewrite={vi.fn()} />
      </PageDraftingContext>,
    );
    expect(screen.queryByRole("button", { name: "Shorter" })).not.toBeInTheDocument();
  });
});
