import { posix } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { Client } from "basic-ftp";
import { type RemoteFolder, remotePath, temporaryName } from "./remote-folder.js";

export interface FtpSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  remoteFolder: string;
  /**
   * "explicit": FTPS, starting plain and switching to TLS (what cPanel offers on port 21).
   * "implicit": TLS from the first byte (port 990). "none": plain FTP, which sends the
   * password unencrypted and is only offered because some old hosts have nothing else.
   */
  security: "explicit" | "implicit" | "none";
  /** Tests use a self-signed certificate; real hosts must present a valid one. */
  allowSelfSignedCertificate?: boolean;
}

const TIMEOUT_MILLISECONDS = 30_000;

/** FTP and FTPS, which every cPanel and shared host offers. Passive mode, as hosts expect. */
export async function openFtpRemote(settings: FtpSettings): Promise<RemoteFolder> {
  const client = new Client(TIMEOUT_MILLISECONDS);
  await client.access({
    host: settings.host,
    port: settings.port,
    user: settings.username,
    password: settings.password,
    secure:
      settings.security === "none" ? false : settings.security === "implicit" ? "implicit" : true,
    secureOptions: { rejectUnauthorized: !settings.allowSelfSignedCertificate },
  });
  const start = await client.pwd();
  const absolute = (path: string) =>
    posix.normalize(posix.join(start, remotePath(settings.remoteFolder, path)));
  const madeFolders = new Set<string>();

  return {
    async readFile(path) {
      const chunks: Buffer[] = [];
      const sink = new PassThrough();
      sink.on("data", (chunk: Buffer) => chunks.push(chunk));
      try {
        await client.downloadTo(sink, absolute(path));
        return Buffer.concat(chunks);
      } catch {
        return null;
      }
    },
    async writeFile(path, content) {
      const target = absolute(path);
      const folder = posix.dirname(target);
      if (!madeFolders.has(folder)) {
        await client.ensureDir(folder);
        await client.cd(start);
        madeFolders.add(folder);
      }
      const temporary = temporaryName(target);
      await client.uploadFrom(Readable.from(content), temporary);
      try {
        await client.rename(temporary, target);
      } catch {
        // Some servers won't rename over an existing file.
        await client.remove(target, true);
        await client.rename(temporary, target);
      }
    },
    async deleteFile(path) {
      await client.remove(absolute(path), true);
    },
    async close() {
      client.close();
    },
  };
}
