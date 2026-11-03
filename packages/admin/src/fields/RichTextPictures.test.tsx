import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as MediaApi from "../media/media.api.js";
import { makeAsset } from "../media/media.test-helpers.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { FieldValue, RichTextDocument } from "./field.types.js";
import { FieldEditor } from "./FieldEditor.js";

const uploadAsset = vi.hoisted(() => vi.fn());
vi.mock("../media/media.api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof MediaApi>()),
  uploadAsset,
}));

const shopFront = makeAsset({
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  filename: "shop-front.jpg",
  alt: "Our shop on the high street",
});
const pasted = makeAsset({
  id: "aaaaaaaa-0000-4000-8000-000000000002",
  filename: "Pasted picture 10.00.00.png",
  alt: "",
});

function serveLibrary() {
  return mockApi(({ url }) => {
    if (url.pathname === "/media" && url.searchParams.get("type") === "image") {
      return { assets: [shopFront], total: 1 };
    }
    if (url.pathname === `/media/${shopFront.id}`) return shopFront;
    if (url.pathname === `/media/${pasted.id}`) return pasted;
    throw new Error(`Unexpected request to ${url.pathname}`);
  });
}

const article: RichTextDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello there" }] }],
};

function renderRichText(initial: RichTextDocument = article) {
  const changes = vi.fn<(value: FieldValue) => void>();
  function ControlledField() {
    const [value, setValue] = useState<unknown>(initial);
    return (
      <FieldEditor
        field={{ handle: "body", label: "Body", type: "richText", required: false, options: {} }}
        value={value}
        onChange={(_handle, next) => {
          changes(next);
          setValue(next);
        }}
      />
    );
  }
  renderScreen(<ControlledField />);
  return changes;
}

function picturesIn(value: FieldValue | undefined) {
  return ((value as RichTextDocument | undefined)?.content ?? []).filter(
    (node) => node.type === "image",
  );
}

afterEach(() => vi.restoreAllMocks());

describe("pictures in rich text", () => {
  it("adds a picture from the library, then asks for its description", async () => {
    serveLibrary();
    const changes = renderRichText();
    await userEvent.click(await screen.findByRole("textbox", { name: "Body" }));

    await userEvent.click(screen.getByRole("button", { name: "Add picture" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an image" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /shop-front\.jpg/ }));

    await waitFor(() =>
      expect(picturesIn(changes.mock.lastCall?.[0])).toEqual([
        {
          type: "image",
          attrs: {
            assetId: shopFront.id,
            alt: "Our shop on the high street",
            caption: "",
            align: "full",
          },
        },
      ]),
    );
    // The library's description is the starting point, ready to change.
    const description = await screen.findByLabelText("Describe the picture");
    expect(description).toHaveValue("Our shop on the high street");
    expect(description).toHaveFocus();
    expect(await screen.findByRole("img", { name: "Our shop on the high street" })).toBeVisible();

    await userEvent.clear(description);
    await userEvent.type(description, "The bakery at dawn");
    await userEvent.type(screen.getByLabelText("Caption"), "Open from seven");
    await userEvent.click(screen.getByRole("radio", { name: "Left" }));

    expect(picturesIn(changes.mock.lastCall?.[0])[0]?.attrs).toEqual({
      assetId: shopFront.id,
      alt: "The bakery at dawn",
      caption: "Open from seven",
      align: "left",
    });
  });

  it("uploads a pasted picture and puts it in the text", async () => {
    serveLibrary();
    uploadAsset.mockResolvedValue(pasted);
    const changes = renderRichText();
    const editor = await screen.findByRole("textbox", { name: "Body" });
    await userEvent.click(editor);

    const file = new File(["png"], "image.png", { type: "image/png" });
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: { files: [file], types: ["Files"], getData: () => "" },
    });
    editor.dispatchEvent(paste);

    await waitFor(() => expect(picturesIn(changes.mock.lastCall?.[0])).toHaveLength(1));
    expect(uploadAsset).toHaveBeenCalledTimes(1);
    expect(picturesIn(changes.mock.lastCall?.[0])[0]?.attrs?.assetId).toBe(pasted.id);
    expect(
      await screen.findByText(
        "Picture added to your media. Describe it, for people who can’t see it.",
      ),
    ).toBeInTheDocument();
    // No description yet: the editor asks for one.
    expect(screen.getByLabelText("Describe the picture")).toHaveValue("");
    expect(
      screen.getByText("No description yet. Click the picture to add one."),
    ).toBeInTheDocument();
  });

  it("removes a picture, and Done goes back to writing", async () => {
    serveLibrary();
    const changes = renderRichText();
    await userEvent.click(await screen.findByRole("textbox", { name: "Body" }));
    await userEvent.click(screen.getByRole("button", { name: "Add picture" }));
    const dialog = await screen.findByRole("dialog", { name: "Choose an image" });
    await userEvent.click(await within(dialog).findByRole("button", { name: /shop-front\.jpg/ }));
    await waitFor(() => expect(picturesIn(changes.mock.lastCall?.[0])).toHaveLength(1));

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByLabelText("Describe the picture")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add picture" }));
    const again = await screen.findByRole("dialog", { name: "Choose an image" });
    await userEvent.click(await within(again).findByRole("button", { name: /shop-front\.jpg/ }));
    await waitFor(() => expect(picturesIn(changes.mock.lastCall?.[0])).toHaveLength(2));
    await userEvent.click(await screen.findByRole("button", { name: "Remove picture" }));

    await waitFor(() => expect(picturesIn(changes.mock.lastCall?.[0])).toHaveLength(1));
  });
});
