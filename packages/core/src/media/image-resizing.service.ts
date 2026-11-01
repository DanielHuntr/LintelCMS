import { loadImageLibrary } from "./image-library.js";
import type { ImageResizingStatus } from "./media.schema.js";

/**
 * Whether this server can resize images: false when sharp can't load, so images are
 * served at their original size, with sharp's reason. The admin's media library warns.
 */
export async function findImageResizingStatus(): Promise<ImageResizingStatus> {
  const library = await loadImageLibrary();
  return library.available
    ? { available: true, problem: null }
    : { available: false, problem: library.problem };
}
