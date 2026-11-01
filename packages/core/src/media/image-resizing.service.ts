import { loadImageLibrary } from "./image-library.js";

export interface ImageResizingStatus {
  /** False when sharp can't load on this server, so images are served at their original size. */
  available: boolean;
  /** Why not, in sharp's words, for whoever looks after the server. */
  problem: string | null;
}

/** Whether this server can resize images. The admin's media library warns when it can't. */
export async function findImageResizingStatus(): Promise<ImageResizingStatus> {
  const library = await loadImageLibrary();
  return library.available
    ? { available: true, problem: null }
    : { available: false, problem: library.problem };
}
