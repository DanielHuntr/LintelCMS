import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
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
    const reach = relative(resolve(root, ".."), target);
    if (reach === ".." || reach.startsWith(`..${sep}`) || isAbsolute(reach)) {
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
      // Named from the "/" path, not the full one: on Windows that has "\\" and a drive.
      const temporary = full(temporaryName(path));
      await writeFile(temporary, content);
      await rename(temporary, target);
    },
    async deleteFile(path) {
      await rm(full(path), { force: true });
    },
    async close() {},
  };
}
