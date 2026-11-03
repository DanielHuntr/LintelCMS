import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { once } from "node:events";
import type { ModelFiles } from "./model-files.repository.js";
import type { WritingModelFile } from "./writing-model.js";
import { ModelChecksumMismatchError, ModelDownloadFailedError } from "./page-drafts.errors.js";

export type Fetch = typeof fetch;

export interface DownloadOptions {
  files: ModelFiles;
  signal: AbortSignal;
  /** Bytes of the whole model on disk so far, as they arrive. */
  onProgress: (bytesOnDisk: number) => void;
  fetch?: Fetch;
}

/**
 * Downloads every file of the model that isn't whole yet, one after another, then checks it.
 *
 * - Resuming: a ".part" left by a cancelled or broken download is continued with an HTTP
 *   Range request. If the server sends the whole file instead, it starts again from nothing.
 * - Checking: the SHA-256 is worked out as the bytes arrive (the part's earlier bytes are
 *   read back first), and a file whose size or checksum isn't the published one is deleted
 *   and refused. Only a checked file loses its ".part".
 * - Cancelling: aborting `signal` stops at once and keeps the part, ready to resume.
 */
export async function downloadModel(options: DownloadOptions): Promise<void> {
  const { files } = options;
  await files.ensureFolder();
  await files.forgetChecked();
  const done = new Map<string, number>();
  for (const file of files.model.files) {
    const onDisk = await files.bytesOnDisk(file);
    done.set(file.name, onDisk.whole === file.sizeInBytes ? onDisk.whole : onDisk.part);
  }
  const report = () =>
    options.onProgress([...done.values()].reduce((total, bytes) => total + bytes, 0));
  report();

  // Downloaded files are checked as they arrive; files already here are checked after.
  const downloaded = new Set<string>();
  for (const file of files.model.files) {
    const onDisk = await files.bytesOnDisk(file);
    if (onDisk.whole === file.sizeInBytes) {
      // Already here (copied in, or downloaded before): it is still checked below.
      continue;
    }
    await files.removeFile(file);
    await downloadFile(file, options, (bytes) => {
      done.set(file.name, bytes);
      report();
    });
    downloaded.add(file.name);
  }

  for (const file of files.model.files) {
    if (downloaded.has(file.name)) continue;
    if ((await files.checksumOf(files.pathOf(file))) !== file.sha256) {
      await files.removeFile(file);
      throw new ModelChecksumMismatchError(file.name);
    }
  }
  await files.recordChecked();
}

async function downloadFile(
  file: WritingModelFile,
  options: DownloadOptions,
  onBytes: (bytes: number) => void,
): Promise<void> {
  const { files, signal } = options;
  const partPath = files.partPathOf(file);
  let start = (await files.bytesOnDisk(file)).part;
  if (start > file.sizeInBytes) {
    await files.removePart(file);
    start = 0;
  }

  const response = await (options.fetch ?? fetch)(file.url, {
    headers: start > 0 ? { range: `bytes=${start}-` } : {},
    redirect: "follow",
    signal,
  }).catch((error: unknown) => {
    if (signal.aborted) throw error;
    throw new ModelDownloadFailedError("the download address couldn't be reached");
  });
  if (!response.ok || !response.body) {
    throw new ModelDownloadFailedError(`the download address answered ${response.status}`);
  }
  if (start > 0 && response.status !== 206) {
    // The server sent the whole file rather than the rest of it: start again.
    start = 0;
  }

  const hash = createHash("sha256");
  if (start > 0) {
    for await (const chunk of createReadStream(partPath, { end: start - 1 })) {
      hash.update(chunk as Buffer);
    }
  }
  const out = createWriteStream(partPath, { flags: start > 0 ? "a" : "w" });
  let received = start;
  try {
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      received += chunk.byteLength;
      if (received > file.sizeInBytes) break;
      if (!out.write(chunk)) await once(out, "drain");
      onBytes(received);
    }
  } finally {
    out.end();
    await once(out, "close");
  }
  if (signal.aborted) throw signal.reason;
  if (received !== file.sizeInBytes || hash.digest("hex") !== file.sha256) {
    await files.removePart(file);
    onBytes(0);
    throw new ModelChecksumMismatchError(file.name);
  }
  await files.finishPart(file);
}
