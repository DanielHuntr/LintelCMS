import { UnreadableModelError } from "./media.errors.js";

/**
 * 3D model files. Lintel keeps every model as a .glb: one binary file that a page loads in a
 * single request. A .gltf (JSON) is accepted when it carries everything inside it, as
 * base64 `data:` addresses, and is packed into a .glb as it is uploaded; one that points at
 * separate .bin or picture files is refused with a note to export a .glb instead.
 */

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BINARY_CHUNK = 0x004e4942;

interface GltfBuffer {
  uri?: string;
  byteLength: number;
}

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  [key: string]: unknown;
}

interface GltfImage {
  uri?: string;
  bufferView?: number;
  mimeType?: string;
  [key: string]: unknown;
}

interface GltfDocument {
  asset?: { version?: unknown };
  buffers?: GltfBuffer[];
  bufferViews?: GltfBufferView[];
  images?: GltfImage[];
  [key: string]: unknown;
}

const padding = (length: number) => (4 - (length % 4)) % 4;

/** Whether readable text is a glTF document (rather than any other JSON). */
export function looksLikeGltf(text: string): boolean {
  try {
    const parsed = JSON.parse(text) as GltfDocument | null;
    return typeof parsed === "object" && parsed !== null && typeof parsed.asset === "object";
  } catch {
    return false;
  }
}

function decodeDataAddress(address: string, filename: string): { bytes: Buffer; mimeType: string } {
  const match = /^data:([\w/+.-]*)(;base64)?,(.*)$/s.exec(address);
  if (!match?.[2]) throw new UnreadableModelError(filename, "outside");
  return { bytes: Buffer.from(match[3] ?? "", "base64"), mimeType: match[1] ?? "" };
}

function glbFile(json: GltfDocument, binary: Buffer): Buffer {
  const jsonText = JSON.stringify(json);
  const jsonBytes = Buffer.from(jsonText + " ".repeat(padding(Buffer.byteLength(jsonText))));
  const total = 12 + 8 + jsonBytes.length + (binary.length ? 8 + binary.length : 0);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  header.writeUInt32LE(jsonBytes.length, 12);
  header.writeUInt32LE(JSON_CHUNK, 16);
  const chunks: Buffer[] = [header, jsonBytes];
  if (binary.length) {
    const binaryHeader = Buffer.alloc(8);
    binaryHeader.writeUInt32LE(binary.length, 0);
    binaryHeader.writeUInt32LE(BINARY_CHUNK, 4);
    chunks.push(binaryHeader, binary);
  }
  return Buffer.concat(chunks);
}

/** Packs a self-contained .gltf into a .glb with the same contents. */
export function packGltfAsGlb(text: string, filename: string): Buffer {
  try {
    return packDocument(JSON.parse(text) as GltfDocument, filename);
  } catch (error) {
    if (error instanceof UnreadableModelError) throw error;
    // Text that is JSON but not shaped like glTF: lists that aren't lists, and so on.
    throw new UnreadableModelError(filename, "unreadable");
  }
}

function packDocument(gltf: GltfDocument, filename: string): Buffer {
  if (String(gltf.asset?.version ?? "").split(".")[0] !== "2") {
    throw new UnreadableModelError(filename, "version");
  }
  const parts: Buffer[] = [];
  let length = 0;
  const append = (bytes: Buffer) => {
    const offset = length;
    parts.push(bytes, Buffer.alloc(padding(bytes.length)));
    length += bytes.length + padding(bytes.length);
    return offset;
  };
  const bufferOffsets = (gltf.buffers ?? []).map((buffer) =>
    // Only a .glb's own binary part has no address, so here the data is missing.
    append(decodeDataAddress(buffer.uri ?? "", filename).bytes),
  );
  const bufferViews: GltfBufferView[] = (gltf.bufferViews ?? []).map((view) => ({
    ...view,
    buffer: 0,
    byteOffset: (bufferOffsets[view.buffer] ?? 0) + (view.byteOffset ?? 0),
  }));
  const images = (gltf.images ?? []).map((image): GltfImage => {
    if (image.uri === undefined) return image;
    const { bytes, mimeType } = decodeDataAddress(image.uri, filename);
    const rest = Object.fromEntries(Object.entries(image).filter(([key]) => key !== "uri"));
    bufferViews.push({ buffer: 0, byteOffset: append(bytes), byteLength: bytes.length });
    return { ...rest, bufferView: bufferViews.length - 1, mimeType: image.mimeType ?? mimeType };
  });
  const binary = Buffer.concat(parts);
  const json: GltfDocument = { ...gltf };
  delete json.buffers;
  delete json.bufferViews;
  delete json.images;
  if (binary.length) json.buffers = [{ byteLength: binary.length }];
  if (bufferViews.length) json.bufferViews = bufferViews;
  if (images.length) json.images = images;
  return glbFile(json, binary);
}

/** Checks a .glb's own description can be read, so a broken file is refused at upload. */
export function assertGlbIsReadable(contents: Buffer, filename: string): void {
  if (contents.length < 20 || contents.readUInt32LE(0) !== GLB_MAGIC) {
    throw new UnreadableModelError(filename, "unreadable");
  }
  if (contents.readUInt32LE(4) !== 2) throw new UnreadableModelError(filename, "version");
  const jsonLength = contents.readUInt32LE(12);
  if (contents.readUInt32LE(16) !== JSON_CHUNK || 20 + jsonLength > contents.length) {
    throw new UnreadableModelError(filename, "unreadable");
  }
  if (!looksLikeGltf(contents.subarray(20, 20 + jsonLength).toString("utf8"))) {
    throw new UnreadableModelError(filename, "unreadable");
  }
}
