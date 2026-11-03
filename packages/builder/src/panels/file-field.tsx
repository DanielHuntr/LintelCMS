import { Film, RotateCcw } from "lucide-react";
import { createContext, useContext, useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { FileUploader } from "../style-panel/design-tools.js";
import { inputClassName, Labelled } from "../ui/controls.js";

/**
 * A file from the media library for a Content panel field (the Lottie and Rive elements'
 * animation): uploaded with a button, or typed as an address. Empty means the element plays
 * Lintel's sample, which the field says. The app provides the uploader with
 * `FileUploaderContext`; without one, only the address can be typed.
 */

export const FileUploaderContext = createContext<FileUploader | null>(null);

/**
 * The file's name from its address, for "Plays hop.lottie"; empty for the media library's
 * own addresses (…/media/<id>/file), which don't say.
 */
export function fileNameOf(address: string): string {
  if (/\/media\/[^/]+\/file(\?|#|$)/.test(address)) return "";
  const name = address.split(/[?#]/)[0]?.split("/").pop() ?? "";
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

/** Whether a file's name ends with one of the accepted extensions (".json", ".riv"). */
export function hasAcceptedExtension(name: string, accept: readonly string[]): boolean {
  const lower = name.toLowerCase();
  return accept.some((extension) => lower.endsWith(extension.toLowerCase()));
}

const isSafeFileAddress = (address: string) =>
  address === "" || /^(https?:\/\/|\/(?!\/))/i.test(address);

export function FileField({
  label,
  value,
  accept,
  onChange,
}: {
  label: string;
  value: string;
  accept: readonly string[];
  /** The address, and the media library's id when the file was uploaded here. */
  onChange: (value: string, assetId: string) => void;
}) {
  const text = useBuilderText();
  const uploadFile = useContext(FileUploaderContext);
  const inputId = useId();
  const [address, setAddress] = useState(value);
  // Another element selected (or undo): show its address, not the one typed before.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    setAddress(value);
  }
  const [uploading, setUploading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const types = accept.join(" or ");

  const upload = async (file: File | undefined) => {
    if (!file || !uploadFile) return;
    if (!hasAcceptedExtension(file.name, accept)) {
      setProblem(text("pageBuilder.file.wrongType", { types }));
      return;
    }
    setUploading(true);
    const uploaded = await uploadFile(file)
      .catch(() => null)
      .finally(() => setUploading(false));
    if (!uploaded) {
      setProblem(text("pageBuilder.file.failed"));
      return;
    }
    setProblem(null);
    setAddress(uploaded.src);
    onChange(uploaded.src, uploaded.assetId ?? "");
  };

  return (
    <Labelled label={label}>
      {(id) => (
        <div className="flex flex-col gap-2">
          <p className="text-caption text-label-secondary">
            {!value
              ? text("pageBuilder.file.sample")
              : fileNameOf(value)
                ? text("pageBuilder.file.chosen", { name: fileNameOf(value) })
                : text("pageBuilder.file.fromLibrary")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {uploadFile && (
              <label
                htmlFor={inputId}
                className="flex h-8 cursor-pointer items-center gap-1.5 rounded-control bg-fill px-2.5 text-footnote font-medium text-accent hover:bg-fill-strong focus-within:focus-ring"
              >
                <Film aria-hidden="true" className="size-4" />
                {uploading
                  ? text("pageBuilder.file.uploading")
                  : value
                    ? text("pageBuilder.file.change")
                    : text("pageBuilder.file.upload")}
                <input
                  id={inputId}
                  type="file"
                  accept={accept.join(",")}
                  className="sr-only"
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
              </label>
            )}
            {value && (
              <button
                type="button"
                onClick={() => {
                  setAddress("");
                  onChange("", "");
                }}
                className="flex h-8 items-center gap-1.5 rounded-control px-2 text-footnote text-label-secondary hover:bg-fill focus-visible:focus-ring"
              >
                <RotateCcw aria-hidden="true" className="size-3.5" />
                {text("pageBuilder.file.useSample")}
              </button>
            )}
          </div>
          {problem && (
            <p role="alert" className="text-caption text-danger">
              {problem}
            </p>
          )}
          <input
            id={id}
            aria-label={text("pageBuilder.file.address")}
            placeholder="/media/…"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              if (isSafeFileAddress(event.target.value.trim()))
                onChange(event.target.value.trim(), "");
            }}
            className={inputClassName}
          />
        </div>
      )}
    </Labelled>
  );
}
