/**
 * Files from a paste or a drop. A screenshot pasted from the clipboard can arrive without a
 * usable name ("image" or nothing at all), and the upload rules judge a file by its
 * extension, so such a picture is named after its type: "Pasted picture 14.03.22.png".
 */
const extensionsByType: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

export function filesFrom(list: DataTransfer | null | undefined): File[] {
  return [...(list?.files ?? [])].map((file) => withUsableName(file));
}

/** Only the pictures among them. */
export function picturesFrom(list: DataTransfer | null | undefined): File[] {
  return filesFrom(list).filter((file) => file.type.startsWith("image/"));
}

/** True when what's being dragged or pasted includes files, before they can be read. */
export function carriesFiles(list: DataTransfer | null | undefined): boolean {
  return [...(list?.types ?? [])].includes("Files");
}

export function withUsableName(file: File, now = new Date()): File {
  if (/\.[a-z0-9]+$/i.test(file.name)) return file;
  const extension = extensionsByType[file.type];
  if (!extension) return file;
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(".");
  return new File([file], `Pasted picture ${time}.${extension}`, { type: file.type });
}

/**
 * True for places where pasting means pasting text: text areas and rich text. An ordinary
 * one-line field (a search box, say) can't hold a picture, so pictures pasted there still count.
 */
export function isWritingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable === true)
  );
}
