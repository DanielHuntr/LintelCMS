import type { PageNode } from "@lintel/builder-model";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { englishText } from "../i18n/builder-text.js";
import { readFrameMessage } from "./canvas-messages.js";
import { type PictureUploader, usePictureDrop } from "./usePictureDrop.js";

function node(id: string, type: string, props: Record<string, unknown> = {}): PageNode {
  return {
    id,
    type,
    name: "",
    props,
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
  };
}

const root: PageNode = {
  ...node("page", "page"),
  children: [
    node("photo", "image", { src: "", alt: "Our shop", assetId: null }),
    node("title", "heading"),
  ],
};
const photo = new File(["bytes"], "harbour.jpg", { type: "image/jpeg" });

function setUp(uploadPicture: PictureUploader | undefined) {
  const changeProps = vi.fn();
  const select = vi.fn();
  const announce = vi.fn();
  const hook = renderHook(() =>
    usePictureDrop({ root, uploadPicture, changeProps, select, announce, text: englishText }),
  );
  return { hook, changeProps, select, announce };
}

describe("pictures dropped or pasted on the canvas", () => {
  it("upload into the Picture element they land on, keeping its description", async () => {
    const upload = vi.fn<PictureUploader>(async () => ({
      assetId: "a1",
      src: "http://api.test/media/a1/file",
      alt: "",
    }));
    const { hook, changeProps, select, announce } = setUp(upload);

    await act(() => hook.result.current.placePictures("photo", [photo], "drop"));

    expect(upload).toHaveBeenCalledWith(photo);
    expect(select).toHaveBeenCalledWith("photo");
    expect(changeProps).toHaveBeenCalledWith(
      "photo",
      { src: "http://api.test/media/a1/file", assetId: "a1", alt: "Our shop" },
      "Change picture",
    );
    expect(announce).toHaveBeenCalledWith("Uploading harbour.jpg…");
    expect(hook.result.current.status).toEqual({
      state: "done",
      message: "Picture added to the page and to your media.",
    });
  });

  it("say where pictures go when dropped on something else, without uploading", async () => {
    const upload = vi.fn<PictureUploader>();
    const { hook, changeProps } = setUp(upload);

    await act(() => hook.result.current.placePictures("title", [photo], "drop"));

    expect(upload).not.toHaveBeenCalled();
    expect(changeProps).not.toHaveBeenCalled();
    expect(hook.result.current.status).toMatchObject({
      state: "failed",
      message: expect.stringContaining("Pictures go into a Picture element"),
    });
  });

  it("ask for a Picture element to be selected before pasting", async () => {
    const { hook } = setUp(vi.fn<PictureUploader>());

    await act(() => hook.result.current.placePictures(null, [photo], "paste"));

    expect(hook.result.current.status).toMatchObject({
      message: "To paste a picture, select a Picture element on the page first.",
    });
  });

  it("explain a failed upload in the media library's own words", async () => {
    const upload = vi.fn<PictureUploader>(async () => {
      throw new Error("“harbour.jpg” is larger than 25 MB. Try a smaller or compressed version.");
    });
    const { hook, changeProps } = setUp(upload);

    await act(() => hook.result.current.placePictures("photo", [photo], "drop"));

    expect(changeProps).not.toHaveBeenCalled();
    expect(hook.result.current.status).toEqual({
      state: "failed",
      message:
        "Couldn’t use harbour.jpg. “harbour.jpg” is larger than 25 MB. Try a smaller or compressed version.",
    });
  });

  it("are ignored when the app gives no way to upload them", async () => {
    const { hook } = setUp(undefined);

    await act(() => hook.result.current.placePictures("photo", [photo], "drop"));

    expect(hook.result.current.status).toBeNull();
    expect(hook.result.current.canPlacePictures).toBe(false);
  });
});

// The frame runs the page's own code, so its messages are checked before they are used.
describe("file messages from the canvas", () => {
  it("accept real files, and refuse anything else", () => {
    expect(readFrameMessage({ type: "dropFiles", nodeId: "photo", files: [photo] })).toEqual({
      type: "dropFiles",
      nodeId: "photo",
      files: [photo],
    });
    expect(readFrameMessage({ type: "pasteFiles", files: [photo] })).toEqual({
      type: "pasteFiles",
      files: [photo],
    });
    expect(
      readFrameMessage({ type: "dropFiles", nodeId: null, files: ["harbour.jpg"] }),
    ).toBeNull();
    expect(readFrameMessage({ type: "pasteFiles", files: [] })).toBeNull();
    expect(
      readFrameMessage({ type: "pasteFiles", files: Array.from({ length: 11 }, () => photo) }),
    ).toBeNull();
  });
});
