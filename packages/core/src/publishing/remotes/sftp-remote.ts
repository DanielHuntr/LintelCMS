import { posix } from "node:path";
import { Client, type SFTPWrapper } from "ssh2";
import { type RemoteFolder, remotePath, temporaryName } from "./remote-folder.js";

export interface SftpSettings {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remoteFolder: string;
}

const CONNECT_TIMEOUT_MILLISECONDS = 20_000;

/** SFTP: files over SSH, offered by most VPS and many shared hosts (cPanel "SSH access"). */
export async function openSftpRemote(settings: SftpSettings): Promise<RemoteFolder> {
  const client = new Client();
  await new Promise<void>((resolve, reject) => {
    client.once("ready", () => resolve());
    client.once("error", reject);
    client.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      password: settings.password,
      privateKey: settings.privateKey,
      readyTimeout: CONNECT_TIMEOUT_MILLISECONDS,
    });
  });
  const sftp = await new Promise<SFTPWrapper>((resolve, reject) =>
    client.sftp((error, wrapper) => (error ? reject(error) : resolve(wrapper))),
  );
  const madeFolders = new Set<string>();
  const full = (path: string) => remotePath(settings.remoteFolder, path);

  const ensureFolder = async (folder: string): Promise<void> => {
    if (folder === "." || folder === "/" || madeFolders.has(folder)) return;
    await ensureFolder(posix.dirname(folder));
    const exists = await new Promise<boolean>((resolve) =>
      sftp.stat(folder, (error) => resolve(!error)),
    );
    if (!exists) {
      await call((done) => sftp.mkdir(folder, done)).catch(async (error: unknown) => {
        // Another upload made it in the meantime.
        const nowExists = await new Promise<boolean>((resolve) =>
          sftp.stat(folder, (statError) => resolve(!statError)),
        );
        if (!nowExists) throw error;
      });
    }
    madeFolders.add(folder);
  };

  return {
    async readFile(path) {
      return new Promise((resolve) =>
        sftp.readFile(full(path), (error, content) => resolve(error ? null : content)),
      );
    },
    async writeFile(path, content) {
      const target = full(path);
      await ensureFolder(posix.dirname(target));
      const temporary = temporaryName(target);
      await call((done) => sftp.writeFile(temporary, content, done));
      // OpenSSH's rename replaces the old file in one step; plain SFTP needs it gone first.
      await call((done) => sftp.ext_openssh_rename(temporary, target, done)).catch(async () => {
        await call((done) => sftp.unlink(target, done)).catch(() => undefined);
        await call((done) => sftp.rename(temporary, target, done));
      });
    },
    async deleteFile(path) {
      await call((done) => sftp.unlink(full(path), done)).catch((error: unknown) => {
        if (!isMissing(error)) throw error;
      });
    },
    async close() {
      sftp.end();
      client.end();
    },
  };
}

function call(action: (done: (error?: Error | null) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => action((error) => (error ? reject(error) : resolve())));
}

function isMissing(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 2;
}
