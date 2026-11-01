import { t } from "../i18n/strings.js";

/**
 * The same rules the API applies, checked in the browser first so people hear about a
 * file that's too big before waiting for it to upload. The API still checks every file's
 * real type from its bytes; this only looks at the name and the browser's guess.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const allowedExtensions = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "gif",
  "svg",
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "txt",
  "csv",
  "woff2",
  "ttf",
  "otf",
  "mp4",
  "webm",
] as const;

const imageExtensions = ["jpg", "jpeg", "png", "webp", "avif", "gif", "svg"] as const;

/** For a file input's `accept`, so the file chooser greys out everything else. */
export const acceptedFileTypes = allowedExtensions.map((extension) => `.${extension}`).join(",");
export const acceptedImageTypes = imageExtensions.map((extension) => `.${extension}`).join(",");

/** Why this file can't be uploaded, in words for the person, or undefined when it's fine. */
export function findUploadProblem(
  file: Pick<File, "name" | "size">,
  options: { imagesOnly?: boolean } = {},
): string | undefined {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed: readonly string[] = options.imagesOnly ? imageExtensions : allowedExtensions;

  if (!file.name.includes(".") || !allowed.includes(extension)) {
    return t("media.upload.typeNotAllowed", { name: file.name });
  }
  if (file.size === 0) {
    return t("media.upload.empty", { name: file.name });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return t("media.upload.tooLarge", { name: file.name });
  }
  return undefined;
}
