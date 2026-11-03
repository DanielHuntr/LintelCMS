import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { insertPictureMarkdown, MarkdownFieldEditor } from "../fields/MarkdownFieldEditor.js";
import type { FieldEditorProps } from "../fields/fieldEditorProps.js";
import { renderScreen } from "../testing/renderScreen.js";
import { MediaLibraryPage } from "./MediaLibraryPage.js";
import { MediaPicker } from "./MediaPicker.js";
import type * as mediaApi from "./media.api.js";
import { uploadAsset } from "./media.api.js";
import { makeAsset, mockApi, renderWithQueries } from "./media.test-helpers.js";
import { isWritingTarget, withUsableName } from "./pastedFiles.js";
import { uploadPicture } from "./uploadPicture.js";

vi.mock("./media.api.js", async (importOriginal) => ({
  ...(await importOriginal<typeof mediaApi>()),
  uploadAsset: vi.fn(),
}));

const harbour = makeAsset({ id: "aaaaaaaa-0000-4000-8000-000000000001", filename: "harbour.jpg" });
const photo = new File(["picture"], "harbour.jpg", { type: "image/jpeg" });
const uploadMock = vi.mocked(uploadAsset);

function serveLibrary() {
  return mockApi((path) => {
    if (path.startsWith("/media?")) return { assets: [harbour], total: 1 };
    if (path === `/media/${harbour.id}`) return harbour;
    return { sites: [] };
  });
}

function files(list: File[]) {
  return { types: ["Files"], files: list, getData: () => "" };
}

afterEach(() => {
  vi.restoreAllMocks();
  uploadMock.mockReset();
});

describe("a picture dropped or pasted on an image field", () => {
  it("is uploaded and chosen, with its progress shown", async () => {
    serveLibrary();
    let finish: (asset: typeof harbour) => void = () => undefined;
    uploadMock.mockImplementation((_file, onProgress) => {
      onProgress(0.4);
      return new Promise((resolve) => (finish = resolve));
    });
    const onChange = vi.fn();
    renderWithQueries(<MediaPicker value={null} onChange={onChange} label="Hero image" />);
    const field = screen.getByRole("group", { name: "Hero image" });

    fireEvent.dragEnter(field, { dataTransfer: files([photo]) });
    expect(screen.getByText("Drop to use this picture")).toBeInTheDocument();
    fireEvent.drop(field, { dataTransfer: files([photo]) });

    expect(await screen.findByText("Uploading harbour.jpg… 40%")).toBeInTheDocument();
    finish(harbour);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(harbour.id));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Picture added to your media and chosen here.",
    );
  });

  it("works by pasting while the field has focus", async () => {
    serveLibrary();
    uploadMock.mockResolvedValue(harbour);
    const onChange = vi.fn();
    renderWithQueries(<MediaPicker value={null} onChange={onChange} label="Hero image" />);

    fireEvent.paste(screen.getByRole("button", { name: "Choose image" }), {
      clipboardData: files([photo]),
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(harbour.id));
  });

  it("says plainly when the file isn't a picture, and sends nothing", async () => {
    serveLibrary();
    renderWithQueries(<MediaPicker value={null} onChange={vi.fn()} label="Hero image" />);

    fireEvent.drop(screen.getByRole("group", { name: "Hero image" }), {
      dataTransfer: files([new File(["%PDF"], "menu.pdf", { type: "application/pdf" })]),
    });

    expect(await screen.findByText(/“menu.pdf” isn’t a picture/)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });
});

describe("pasting in the media library", () => {
  it("uploads what was pasted, as dropping does", async () => {
    serveLibrary();
    uploadMock.mockResolvedValue(harbour);
    renderScreen(<MediaLibraryPage permissions={["*"]} />);
    await screen.findByRole("button", { name: "Upload" });

    fireEvent.paste(document.body, { clipboardData: files([photo]) });

    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(uploadMock.mock.calls[0]?.[0]).toBe(photo);
  });
});

function fieldProps(overrides: Partial<FieldEditorProps>): FieldEditorProps {
  return {
    field: { handle: "body", label: "Body", type: "markdown", required: false, options: {} },
    value: "",
    onChange: vi.fn(),
    controlId: "body",
    labelId: "body-label",
    describedBy: undefined,
    hasError: false,
    ...overrides,
  } as FieldEditorProps;
}

describe("a picture pasted into Markdown", () => {
  it("is uploaded and written in where the cursor was", async () => {
    serveLibrary();
    uploadMock.mockResolvedValue(harbour);
    const onChange = vi.fn();
    renderWithQueries(<MarkdownFieldEditor {...fieldProps({ value: "Fresh bread", onChange })} />);
    const box = screen.getByRole("textbox");
    (box as HTMLTextAreaElement).setSelectionRange(11, 11);

    fireEvent.paste(box, { clipboardData: files([photo]) });

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(`Fresh bread\n\n![](${harbour.url})`),
    );
    expect(screen.getByText(/Describe it between the square brackets/)).toBeInTheDocument();
  });

  it("sits on a line of its own", () => {
    expect(insertPictureMarkdown("One\n\nTwo", 3, "/a.jpg")).toBe("One\n\n![](/a.jpg)\n\nTwo");
    expect(insertPictureMarkdown("", 0, "/a.jpg")).toBe("![](/a.jpg)");
  });
});

describe("pasted files", () => {
  it("get a usable name when the clipboard gives none", () => {
    const screenshot = new File(["png"], "image", { type: "image/png" });

    expect(withUsableName(screenshot, new Date(2026, 10, 3, 14, 3, 22)).name).toBe(
      "Pasted picture 14.03.22.png",
    );
    expect(withUsableName(photo)).toBe(photo);
  });

  it("are left to text areas, which take pasted text", () => {
    expect(isWritingTarget(document.createElement("textarea"))).toBe(true);
    expect(isWritingTarget(document.createElement("input"))).toBe(false);
  });
});

describe("uploading a picture for the page builder", () => {
  it("refuses what isn't a picture before sending, in plain words", async () => {
    const upload = vi.fn();

    await expect(
      uploadPicture(new File(["x"], "notes.txt", { type: "text/plain" }), upload),
    ).rejects.toThrow("“notes.txt” isn’t a picture.");
    expect(upload).not.toHaveBeenCalled();
  });
});
