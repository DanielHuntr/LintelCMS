import { posix } from "node:path";

/**
 * A place files are published to, whatever the protocol: an FTP account, an SFTP server,
 * an S3 bucket or a folder. Paths are relative to the folder the target points at, with
 * "/" separators; `../` reaches beside it, for the companion's private folder.
 *
 * `writeFile` is as close to atomic as the protocol allows: the file is uploaded under a
 * temporary name and then renamed, so a visitor never gets half a page.
 */
export interface RemoteFolder {
  readFile(path: string): Promise<Buffer | null>;
  writeFile(path: string, content: Buffer): Promise<void>;
  deleteFile(path: string): Promise<void>;
  close(): Promise<void>;
}

const STAND_IN_FOLDER = "/a/b/c/d/e/f/g/h";

/** Joins a target's folder and a path inside it, keeping it from climbing out further. */
export function remotePath(root: string, path: string): string {
  const joined = posix.normalize(posix.join(root || ".", path));
  // Measured from a stand-in folder, so a relative root is compared like an absolute one.
  const parent = posix.resolve(STAND_IN_FOLDER, root || ".", "..");
  const reach = posix.relative(parent, posix.resolve(STAND_IN_FOLDER, joined));
  if (reach === ".." || reach.startsWith("../")) {
    throw new Error(`"${path}" would be outside the folders Lintel publishes to.`);
  }
  return joined;
}

/** A temporary name beside the real one, for upload-then-rename. */
export function temporaryName(path: string): string {
  const folder = posix.dirname(path);
  const name = posix.basename(path);
  return posix.join(folder, `.${name}.lintel-upload-${process.pid}-${Date.now().toString(36)}`);
}
