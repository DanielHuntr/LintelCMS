import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PublishingSection } from "../content/PublishingSection.js";
import { samplePost } from "../content/testEntries.js";
import type { Field } from "../fields/field.types.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { CompareWithLiveDialog } from "./CompareWithLiveDialog.js";
import { listFieldChanges, richTextAsPlainText } from "./fieldChanges.js";
import { diffWords } from "./textDiff.js";

afterEach(() => vi.restoreAllMocks());

const words = { on: "On", off: "Off", empty: "Empty" };

function field(handle: string, type: Field["type"], options: Field["options"] = {}): Field {
  return {
    handle,
    label: handle[0]?.toUpperCase() + handle.slice(1),
    type,
    required: false,
    options,
  };
}

describe("comparing words", () => {
  it("marks only what changed", () => {
    expect(diffWords("Open 9 to 5", "Open 8 to 5")).toEqual([
      { kind: "same", text: "Open " },
      { kind: "removed", text: "9" },
      { kind: "added", text: "8" },
      { kind: "same", text: " to 5" },
    ]);
  });

  it("reads a rewritten stretch as one removal and one addition", () => {
    expect(diffWords("Closed on Sundays", "Open every day")).toEqual([
      { kind: "removed", text: "Closed on Sundays" },
      { kind: "added", text: "Open every day" },
    ]);
  });

  it("handles text that was empty, or emptied", () => {
    expect(diffWords("", "New")).toEqual([{ kind: "added", text: "New" }]);
    expect(diffWords("Old", "")).toEqual([{ kind: "removed", text: "Old" }]);
  });
});

describe("listing what changed", () => {
  const fields = [
    field("title", "text"),
    field("hero", "image"),
    field("body", "richText"),
    field("design", "page"),
    field("colour", "select", {
      choices: [
        { value: "rye", label: "Rye loaf" },
        { value: "spelt", label: "Spelt loaf" },
      ],
    }),
    field("featured", "toggle"),
    field("layout", "section"),
  ];

  it("names each changed field in the content type's order, with what kind of change", () => {
    const live = {
      title: "Spring menu",
      hero: "a1",
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh daily" }] }],
      },
      design: { version: 1, root: { id: "page" } },
      colour: "rye",
      featured: false,
      retired: "old value",
    };
    const saved = {
      title: "Spring menu",
      hero: null,
      body: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh every morning" }] }],
      },
      design: { version: 1, root: { id: "page", children: [] } },
      colour: "spelt",
      featured: true,
    };

    const changes = listFieldChanges(fields, live, saved, words);

    expect(changes.map((change) => [change.handle, change.kind])).toEqual([
      ["hero", "picture"],
      ["body", "text"],
      ["design", "design"],
      ["colour", "value"],
      ["featured", "value"],
      ["retired", "other"],
    ]);
    expect(changes[0]).toMatchObject({ before: "a1", after: null });
    expect(changes[3]).toMatchObject({ before: "Rye loaf", after: "Spelt loaf" });
    expect(changes[4]).toMatchObject({ before: "Off", after: "On" });
  });

  it("reads rich text as its words, a line per paragraph", () => {
    expect(
      richTextAsPlainText({
        type: "doc",
        content: [
          { type: "heading", content: [{ type: "text", text: "Hours" }] },
          { type: "paragraph", content: [{ type: "text", text: "9 to 5" }] },
        ],
      }),
    ).toBe("Hours\n9 to 5");
  });
});

describe("the Compare with live dialog", () => {
  it("shows removed and added words in a way that doesn't rely on colour", async () => {
    mockApi(({ url }) =>
      url.pathname.endsWith("/live")
        ? {
            publishedAt: "2026-10-30T09:00:00.000Z",
            data: { title: "Open 9 to 5", design: { a: 1 } },
          }
        : {},
    );
    renderScreen(
      <CompareWithLiveDialog
        entryId="e1"
        fields={[field("title", "text"), field("design", "page")]}
        current={{ title: "Open 8 to 5", design: { a: 2 } }}
        hasUnsavedChanges={false}
        viewPage={{ kind: "website", href: "https://bakery.test/spring" }}
        onClose={() => undefined}
      />,
    );

    const dialog = await screen.findByRole("dialog", { name: "Compare with live" });
    const removed = await within(dialog).findByText("9", { selector: "del" });
    expect(removed).toHaveTextContent("removed: 9 end of removed");
    expect(within(dialog).getByText("8", { selector: "ins" })).toHaveTextContent(
      "added: 8 end of added",
    );
    expect(within(dialog).getByText("Design changed.")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "View the live page" })).toHaveAttribute(
      "href",
      "https://bakery.test/spring",
    );
    expect(within(dialog).getByText(/Removed words are struck through/)).toBeInTheDocument();
  });

  it("says so when nothing differs", async () => {
    mockApi(() => ({ publishedAt: "2026-10-30T09:00:00.000Z", data: { title: "Same" } }));
    renderScreen(
      <CompareWithLiveDialog
        entryId="e1"
        fields={[field("title", "text")]}
        current={{ title: "Same" }}
        hasUnsavedChanges={false}
        viewPage={undefined}
        onClose={() => undefined}
      />,
    );

    expect(await screen.findByText("Nothing differs from the live version.")).toBeInTheDocument();
  });
});

describe("offering Compare with live", () => {
  it("appears only while the site shows an older version", async () => {
    const onCompare = vi.fn();
    const published = samplePost({ status: "published", hasUnpublishedChanges: true });
    renderScreen(
      <PublishingSection
        entry={published}
        canPublish
        isWorking={false}
        onUnpublish={() => undefined}
        onSchedule={() => undefined}
        onCompareWithLive={onCompare}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Compare with live" }));
    expect(onCompare).toHaveBeenCalled();
  });

  it("isn't offered when nothing is waiting", async () => {
    renderScreen(
      <PublishingSection
        entry={samplePost({ status: "published", hasUnpublishedChanges: false })}
        canPublish
        isWorking={false}
        onUnpublish={() => undefined}
        onSchedule={() => undefined}
        onCompareWithLive={() => undefined}
      />,
    );

    await screen.findByText("Status");
    expect(screen.queryByRole("button", { name: "Compare with live" })).not.toBeInTheDocument();
  });
});
