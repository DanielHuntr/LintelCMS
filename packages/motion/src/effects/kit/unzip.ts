/**
 * Reads files out of a zip, which is what a .lottie file is: an animation's JSON with any
 * pictures it uses. Uses the browser's own DecompressionStream, so it costs a page about a
 * kilobyte instead of a zip library.
 */

export interface ZipEntry {
  name: string;
  read: () => Promise<Uint8Array>;
}

const endOfDirectory = 0x06054b50;
const directoryEntry = 0x02014b50;

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Whether the bytes start like a zip ("PK"). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

/** The files in a zip, by name; each is only unpacked when read. */
export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== endOfDirectory) end -= 1;
  if (end < 0) throw new Error("This file isn't a zip.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== directoryEntry) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeader = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    entries.push({
      name,
      read: async () => {
        const start =
          localHeader +
          30 +
          view.getUint16(localHeader + 26, true) +
          view.getUint16(localHeader + 28, true);
        const data = bytes.subarray(start, start + compressedSize);
        if (method === 0) return data;
        if (method === 8) return inflate(data);
        throw new Error(`Can't unpack ${name}.`);
      },
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
