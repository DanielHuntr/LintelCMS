import { HttpError } from "../http/http-errors.js";

/** The upload limit, in megabytes; the routes and the messages below share it. */
export const MAX_UPLOAD_MEGABYTES = 25;

export class NoFileUploadedError extends HttpError {
  constructor() {
    super(400, "INVALID_REQUEST", 'Choose a file to upload (send it in the "file" field).');
  }
}

export class FileTooLargeError extends HttpError {
  constructor() {
    super(
      413,
      "FILE_TOO_LARGE",
      `That file is bigger than ${MAX_UPLOAD_MEGABYTES} MB. Try a smaller or compressed version.`,
    );
  }
}

export class FileTypeNotAllowedError extends HttpError {
  /** `detectedExtension` is what the bytes turned out to be, when that is known. */
  constructor(filename: string, detectedExtension?: string) {
    const whatItIs = detectedExtension
      ? ` It looks like a .${detectedExtension} file, whatever its name says.`
      : "";
    super(
      415,
      "FILE_TYPE_NOT_ALLOWED",
      `"${filename}" isn't a kind of file Lintel accepts.${whatItIs} ` +
        "Upload an image (JPEG, PNG, WebP, AVIF, GIF or SVG), a document " +
        "(PDF, Word, Excel, PowerPoint, text or CSV) or a 3D model (.glb or .gltf).",
    );
  }
}

const modelProblems = {
  unreadable: "can’t be read as a 3D model. Export it again as a .glb file.",
  version: "is an older kind of glTF file. Export it again as glTF 2.0 (a .glb file).",
  outside:
    "points to other files (a .bin or pictures) that weren’t uploaded with it. Export it as a single .glb file instead.",
} as const;

export class UnreadableModelError extends HttpError {
  constructor(filename: string, problem: keyof typeof modelProblems) {
    super(422, "UNREADABLE_MODEL", `"${filename}" ${modelProblems[problem]}`);
  }
}

export class UnsafeSvgError extends HttpError {
  constructor(filename: string, reason: string) {
    super(
      422,
      "UNSAFE_SVG",
      `"${filename}" contains ${reason}, which could run code in visitors' browsers. ` +
        "Export the SVG again without scripts or interactivity, or upload it as a PNG.",
    );
  }
}

export class ImageTooLargeError extends HttpError {
  constructor(filename: string, width: number, height: number, maxMegapixels: number) {
    super(
      413,
      "IMAGE_TOO_LARGE",
      `"${filename}" is ${width} × ${height} pixels, more than the ${maxMegapixels} megapixels Lintel accepts. Make it smaller in a photo editor and upload it again.`,
    );
  }
}

export class UnreadableImageError extends HttpError {
  constructor(filename: string) {
    super(
      422,
      "UNREADABLE_IMAGE",
      `"${filename}" looks like an image but can't be opened. It may be damaged; try exporting it again.`,
    );
  }
}

export class AssetNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That file isn't in the media library. It may have been deleted.");
  }
}

export interface AssetUsage {
  /** The entry's id, for a site font the font's, or for a site cursor the site's. */
  entryId: string;
  /** The entry's title, the font's family, or the site's name. */
  title: string;
  /**
   * Set when it isn't an entry: "siteFonts" for a file one of the site's fonts is made of,
   * "siteCursor" for the picture a site's cursor shows.
   */
  place?: "siteFonts" | "siteCursor";
}

/**
 * Carries the entries that use the asset, so editors can see what to change first.
 * The routes add `usedBy` to the response body (Fastify's error format has no room for it).
 */
export class AssetInUseError extends HttpError {
  readonly usedBy: AssetUsage[];

  constructor(usedBy: AssetUsage[]) {
    const count = usedBy.length;
    const onlyEntries = usedBy.every((usage) => usage.place === undefined);
    const places = onlyEntries
      ? count === 1
        ? "entry"
        : "entries"
      : count === 1
        ? "place"
        : "places";
    super(
      409,
      "ASSET_IN_USE",
      `This file is used in ${count} ${places}. Remove it from there first, then delete it.`,
    );
    this.usedBy = usedBy;
  }
}

export class BinnedAssetNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "NOT_FOUND",
      "That file isn't in the recycle bin. It may have been restored or emptied.",
    );
  }
}

/** The same file was uploaded again while the deleted one was in the bin. */
export class AssetAlreadyInLibraryError extends HttpError {
  constructor(filename: string) {
    super(
      409,
      "ASSET_ALREADY_IN_LIBRARY",
      `“${filename}” is already in the media library: it was uploaded again after it was deleted.`,
    );
  }
}

/** The bytes went missing from storage (moved to another storage, say) while it was binned. */
export class BinnedFileMissingError extends HttpError {
  constructor(filename: string) {
    super(
      409,
      "FILE_MISSING",
      `“${filename}” can't be restored because its file is no longer in storage.`,
    );
  }
}
