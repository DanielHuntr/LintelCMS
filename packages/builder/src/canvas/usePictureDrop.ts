import { findNode, type PageNode } from "@lintel/builder-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Translate } from "../i18n/builder-text.js";
import type { PickedImage } from "../panels/content-fields.js";

/**
 * Uploads a picture to the app's media library and resolves with it, ready for a Picture
 * element. Rejects with an Error whose message says, in plain words, why it couldn't (too
 * big, not a picture, offline), which the builder shows as it is.
 */
export type PictureUploader = (file: File) => Promise<PickedImage>;

export type PictureDropStatus =
  | { state: "uploading"; filename: string }
  | { state: "done"; message: string }
  | { state: "failed"; message: string };

const PICTURE_ELEMENT = "image";
/** How long "Picture added" stays before it goes by itself. Problems stay until dismissed. */
const DONE_MESSAGE_MILLISECONDS = 4000;

interface PictureDropOptions {
  root: PageNode;
  uploadPicture: PictureUploader | undefined;
  changeProps: (nodeId: string, props: Record<string, unknown>, label: string) => void;
  select: (nodeId: string) => void;
  announce: (message: string) => void;
  text: Translate;
}

/**
 * Pictures dropped on, or pasted into, a Picture element on the canvas: the first picture is
 * uploaded to the media library and becomes the element's picture, as if chosen with
 * "Choose a picture". Dropped on anything else, or pasted with nothing suitable selected, it
 * says where pictures go instead. The status is shown on the canvas and read out.
 */
export function usePictureDrop({
  root,
  uploadPicture,
  changeProps,
  select,
  announce,
  text,
}: PictureDropOptions) {
  const [status, setStatus] = useState<PictureDropStatus | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(doneTimer.current), []);

  const show = useCallback(
    (next: PictureDropStatus | null) => {
      clearTimeout(doneTimer.current);
      setStatus(next);
      if (next?.state === "uploading")
        announce(text("pageBuilder.pictureDrop.uploading", { name: next.filename }));
      if (next && next.state !== "uploading") announce(next.message);
      if (next?.state === "done") {
        doneTimer.current = setTimeout(() => setStatus(null), DONE_MESSAGE_MILLISECONDS);
      }
    },
    [announce, text],
  );

  const placePictures = useCallback(
    async (nodeId: string | null, files: readonly File[], how: "drop" | "paste") => {
      if (!uploadPicture) return;
      const picture = files.find((file) => file.type.startsWith("image/")) ?? files[0];
      if (!picture) return;
      const node = nodeId ? findNode(root, nodeId) : undefined;
      if (node?.type !== PICTURE_ELEMENT) {
        show({
          state: "failed",
          message:
            how === "drop"
              ? text("pageBuilder.pictureDrop.notPicture")
              : text("pageBuilder.pictureDrop.selectFirst"),
        });
        return;
      }
      select(node.id);
      show({ state: "uploading", filename: picture.name });
      try {
        const uploaded = await uploadPicture(picture);
        const alt =
          typeof node.props.alt === "string" && node.props.alt ? node.props.alt : uploaded.alt;
        changeProps(
          node.id,
          { src: uploaded.src, assetId: uploaded.assetId, alt },
          text("pageBuilder.pictureDrop.change"),
        );
        show({ state: "done", message: text("pageBuilder.pictureDrop.done") });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "";
        show({
          state: "failed",
          message: text("pageBuilder.pictureDrop.failed", { name: picture.name, reason }),
        });
      }
    },
    [root, uploadPicture, changeProps, select, show, text],
  );

  return useMemo(
    () => ({
      status,
      placePictures,
      dismiss: () => show(null),
      canPlacePictures: uploadPicture !== undefined,
    }),
    [status, placePictures, show, uploadPicture],
  );
}
