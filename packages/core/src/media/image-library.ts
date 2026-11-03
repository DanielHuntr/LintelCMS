import type sharpLibrary from "sharp";

/**
 * sharp, the image library, loaded the first time an image needs it rather than when the
 * server starts. sharp ships a prebuilt native program for each kind of server; on the rare
 * host where none fits (an unusual processor, or a shared host that blocks native code),
 * Lintel still runs: images are measured as "size unknown" and served at their original
 * size, and the admin's media library says why (see GET /media/image-resizing).
 */
export type SharpLibrary = typeof sharpLibrary;

export type ImageLibraryStatus =
  { available: true; sharp: SharpLibrary } | { available: false; problem: string };

let loading: Promise<ImageLibraryStatus> | undefined;

export function loadImageLibrary(): Promise<ImageLibraryStatus> {
  loading ??= importSharp();
  return loading;
}

async function importSharp(): Promise<ImageLibraryStatus> {
  try {
    const loaded = await import("sharp");
    return { available: true, sharp: loaded.default };
  } catch (error) {
    return { available: false, problem: describeLoadProblem(error) };
  }
}

/** sharp's own message explains which file is missing; the first line is enough to act on. */
export function describeLoadProblem(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0]?.trim() || "sharp could not be loaded";
}

/** For tests: pretend sharp did or didn't load. */
export function useImageLibraryForTesting(status: ImageLibraryStatus | undefined): void {
  loading = status ? Promise.resolve(status) : undefined;
}
