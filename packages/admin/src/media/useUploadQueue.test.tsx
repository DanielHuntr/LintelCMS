import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { uploadAsset } from "./media.api.js";
import { makeAsset } from "./media.test-helpers.js";
import { UploadProgressList } from "./UploadProgressList.js";
import { useUploadQueue } from "./useUploadQueue.js";

afterEach(() => vi.restoreAllMocks());

function file(name: string, size: number) {
  const contents = new File(["x"], name);
  Object.defineProperty(contents, "size", { value: size });
  return contents;
}

/** Renders the queue as the library and picker do, and hands back its addFiles. */
function renderQueue(upload: typeof uploadAsset, imagesOnly = false) {
  let addFiles: (files: File[]) => void = () => undefined;
  function Harness() {
    const queue = useUploadQueue({ upload, imagesOnly });
    addFiles = queue.addFiles;
    return <UploadProgressList items={queue.items} onDismiss={queue.dismiss} />;
  }
  render(<Harness />);
  return (files: File[]) => act(() => addFiles(files));
}

describe("upload validation", () => {
  it("explains files that are too big, empty or not allowed, without sending them", async () => {
    const upload = vi.fn();
    const add = renderQueue(upload);

    await add([
      file("film.mov", 1000),
      file("brochure.pdf", 26 * 1024 * 1024),
      file("notes.txt", 0),
    ]);

    expect(screen.getByText(/“film\.mov” isn’t a kind of file Lintel accepts/)).toBeInTheDocument();
    expect(
      screen.getByText("“brochure.pdf” is larger than 25 MB. Try a smaller or compressed version."),
    ).toBeInTheDocument();
    expect(screen.getByText(/“notes\.txt” is empty/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("only takes images in the picker", async () => {
    const upload = vi.fn();
    const add = renderQueue(upload, true);

    await add([file("prices.csv", 100)]);

    expect(
      screen.getByText(/“prices\.csv” isn’t a kind of file Lintel accepts/),
    ).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows progress, then the API's own message when it refuses a file", async () => {
    let finish: (asset: ReturnType<typeof makeAsset>) => void = () => undefined;
    const upload = vi.fn<typeof uploadAsset>((uploaded, onProgress) => {
      if (uploaded.name === "renamed.png") {
        return Promise.reject(
          new ApiError(
            415,
            "FILE_TYPE_NOT_ALLOWED",
            '"renamed.png" isn\'t a kind of file Lintel accepts. It looks like a .exe file, whatever its name says.',
          ),
        );
      }
      onProgress(0.4);
      return new Promise((resolve) => (finish = resolve));
    });
    const add = renderQueue(upload);

    await add([file("renamed.png", 2000), file("harbour.jpg", 2000)]);

    expect(await screen.findByText(/It looks like a \.exe file/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "harbour.jpg" })).toHaveAttribute(
      "aria-valuenow",
      "40",
    );
    await act(async () => finish(makeAsset()));
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });

  it("says when the server can't be reached", async () => {
    const add = renderQueue(vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))));

    await add([file("harbour.jpg", 2000)]);

    expect(await screen.findByText(/couldn’t reach the server/)).toBeInTheDocument();
  });
});
