import { type BackgroundVideo, isSafeImageAddress } from "@lintel/builder-model";
import { Film, ImagePlus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";

const overlays = [
  { value: "", key: "pageBuilder.style.none" },
  { value: "rgb(0 0 0 / 0.3)", key: "pageBuilder.design.darken.light" },
  { value: "rgb(0 0 0 / 0.5)", key: "pageBuilder.design.darken.medium" },
  { value: "rgb(0 0 0 / 0.7)", key: "pageBuilder.design.darken.strong" },
] as const;

/**
 * A muted, looping video behind a section: uploaded to the media library, or by address,
 * with a poster picture (shown until it plays, and to people who prefer less motion) and an
 * overlay to keep text readable. The same at every screen size.
 */
export function BackgroundVideoControls() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const video = tools.node.backgroundVideo;
  const inputId = useId();
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const update = (changes: Partial<BackgroundVideo>) =>
    video && tools.setBackgroundVideo({ ...video, ...changes });

  const upload = async (file: File | undefined) => {
    if (!file || !tools.uploadFile) return;
    setUploading(true);
    const uploaded = await tools.uploadFile(file).finally(() => setUploading(false));
    if (!uploaded || !uploaded.mimeType.startsWith("video/")) {
      setProblem(text("pageBuilder.design.videoUploadFailed"));
      return;
    }
    setProblem(null);
    tools.setBackgroundVideo({
      src: uploaded.src,
      assetId: uploaded.assetId,
      poster: video?.poster ?? "",
      overlay: video?.overlay ?? "",
    });
  };

  const choosePoster = async () => {
    const picked = await tools.pickImage?.({
      label: text("pageBuilder.design.videoPoster"),
      currentAssetId: null,
    });
    if (picked) update({ poster: picked.src });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-separator pt-3">
      <span className="text-caption font-semibold text-label">
        {text("pageBuilder.design.video")}
      </span>
      <p className="text-caption text-label-tertiary">{text("pageBuilder.design.videoHint")}</p>
      {tools.uploadFile && (
        <label
          htmlFor={inputId}
          className="flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-within:focus-ring"
        >
          <Film aria-hidden="true" className="size-3.5" />
          {uploading
            ? text("pageBuilder.design.uploading")
            : video
              ? text("pageBuilder.design.videoChange")
              : text("pageBuilder.design.videoAdd")}
          <input
            id={inputId}
            type="file"
            accept=".mp4,.webm,video/mp4,video/webm"
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
          />
        </label>
      )}
      <Labelled label={text("pageBuilder.design.videoAddress")}>
        {(id) => (
          <input
            id={id}
            key={video?.src ?? ""}
            defaultValue={video?.src ?? ""}
            placeholder="/media/waves.mp4"
            className={inputClassName}
            onBlur={(event) => {
              const address = event.target.value.trim();
              if (address === (video?.src ?? "")) return;
              if (address === "") return tools.setBackgroundVideo(null);
              if (!isSafeImageAddress(address)) {
                setProblem(text("pageBuilder.design.videoBadAddress"));
                return;
              }
              setProblem(null);
              tools.setBackgroundVideo({
                src: address,
                assetId: null,
                poster: video?.poster ?? "",
                overlay: video?.overlay ?? "",
              });
            }}
          />
        )}
      </Labelled>
      {problem && (
        <p role="alert" className="text-caption text-danger">
          {problem}
        </p>
      )}
      {video && (
        <>
          {tools.pickImage && (
            <button
              type="button"
              onClick={() => void choosePoster()}
              className="flex h-8 items-center gap-1.5 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
            >
              <ImagePlus aria-hidden="true" className="size-3.5" />
              {video.poster
                ? text("pageBuilder.design.videoPosterChange")
                : text("pageBuilder.design.videoPoster")}
            </button>
          )}
          <div
            role="group"
            aria-label={text("pageBuilder.design.darken")}
            className="flex flex-wrap gap-1"
          >
            {overlays.map((overlay) => (
              <button
                key={overlay.value}
                type="button"
                aria-pressed={video.overlay === overlay.value}
                onClick={() => update({ overlay: overlay.value })}
                className="h-7 rounded-control bg-fill px-2.5 text-caption font-medium text-label aria-pressed:bg-accent-fill aria-pressed:text-on-accent focus-visible:focus-ring"
              >
                {text(overlay.key)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => tools.setBackgroundVideo(null)}
            className="flex h-8 items-center gap-1.5 self-start rounded-control px-2.5 text-caption font-medium text-danger hover:bg-fill focus-visible:focus-ring"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            {text("pageBuilder.design.videoRemove")}
          </button>
        </>
      )}
    </div>
  );
}
