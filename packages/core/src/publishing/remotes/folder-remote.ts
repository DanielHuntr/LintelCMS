import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { RemoteFolder } from "./remote-folder.js";
import { temporaryName } from "./remote-folder.js";

/**
 * "Folder on this server": a folder Lintel can write to directly, such as the web root of
 * the same machine, or a folder a sync tool watches.
 */
export function openFolderRemote(folderPath: string): RemoteFolder {
  const root = resolve(folderPath);
  const full = (path: string) => {
    const target = resolve(root, path);
    if (!target.startsWith(resolve(root, ".."))) {
      throw new Error(`"${path}" would be outside the folders Lintel publishes to.`);
    }
    return target;
  };
  return {
    async readFile(path) {
      try {
        return await readFile(full(path));
      } catch {
        return null;
      }
    },
    async writeFile(path, content) {
      const target = full(path);
      await mkdir(dirname(target), { recursive: true });
      const temporary = temporaryName(target);
      await writeFile(temporary, content);
      await rename(temporary, target);
    },
    async deleteFile(path) {
      await rm(full(path), { force: true });
    },
    async close() {},
  };
}
