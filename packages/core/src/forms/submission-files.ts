import { HttpError, type FieldMessages } from "../http/http-errors.js";
import { detectFileType, type MediaContext, uploadAsset } from "../media/index.js";
import { type FormField, optionsOf } from "./form-fields.schema.js";
import { requiredMessage, type SubmissionValues, type SubmittedFile } from "./submission-values.js";

/**
 * Files sent with a form. They are checked against the field's limits first (how many, how
 * big, what kind) and only then stored in the media library, so a submission that is turned
 * away leaves nothing behind.
 */
export interface IncomingFile {
  /** The handle of the file field it was sent under. */
  fieldHandle: string;
  filename: string;
  contents: Buffer;
}

const KIND_NAMES = { images: "images", documents: "documents" } as const;

export async function checkSubmittedFiles(
  fields: readonly FormField[],
  files: readonly IncomingFile[],
): Promise<FieldMessages> {
  const messages: FieldMessages = {};
  for (const field of fields) {
    if (field.type !== "file") continue;
    const sent = files.filter((file) => file.fieldHandle === field.handle);
    const problem = await checkFileField(field, sent);
    if (problem) messages[field.handle] = problem;
  }
  return messages;
}

async function checkFileField(
  field: FormField,
  sent: readonly IncomingFile[],
): Promise<string | undefined> {
  const { allowedKinds, maxMegabytes, maxFiles } = optionsOf(field, "file");
  if (sent.length === 0) {
    return field.required ? requiredMessage(field) : undefined;
  }
  if (sent.length > maxFiles) {
    return maxFiles === 1
      ? `${field.label} takes one file`
      : `${field.label} takes at most ${maxFiles} files`;
  }
  for (const file of sent) {
    if (file.contents.length > maxMegabytes * 1024 * 1024) {
      return `"${file.filename}" is bigger than ${maxMegabytes} MB`;
    }
    const kind = await detectKind(file);
    if (!kind || !allowedKinds.includes(kind)) {
      const accepted = allowedKinds.map((allowed) => KIND_NAMES[allowed]).join(" or ");
      return `"${file.filename}" can't be sent here. ${field.label} accepts ${accepted}.`;
    }
  }
  return undefined;
}

async function detectKind(file: IncomingFile): Promise<"images" | "documents" | undefined> {
  try {
    const type = await detectFileType(file.contents, file.filename);
    // 3D models are for editors; a form's file field only takes pictures and documents.
    if (type.kind === "model") return undefined;
    return type.kind === "image" ? "images" : "documents";
  } catch (error) {
    if (error instanceof HttpError) return undefined;
    throw error;
  }
}

/**
 * Stores checked files in the media library and gives back the answers that point at them.
 * `assetIds` are only the files this submission added: the library keeps one copy of any
 * file, so a visitor sending the bytes of an existing image (a product photo, say) gets that
 * image, and deleting their submission mustn't delete it.
 */
export async function storeSubmittedFiles(
  media: MediaContext,
  fields: readonly FormField[],
  files: readonly IncomingFile[],
): Promise<{ values: SubmissionValues; assetIds: string[] }> {
  const values: SubmissionValues = {};
  const assetIds: string[] = [];
  for (const field of fields) {
    if (field.type !== "file") continue;
    const stored: SubmittedFile[] = [];
    for (const file of files.filter((candidate) => candidate.fieldHandle === field.handle)) {
      const { asset, created } = await uploadAsset(media, file, null);
      stored.push({
        assetId: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
      });
      if (created) assetIds.push(asset.id);
    }
    if (stored.length > 0) values[field.handle] = stored;
  }
  return { values, assetIds };
}
