import {
  closeSync,
  constants,
  fstatSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { join, normalize } from "node:path";
import ssh2 from "ssh2";

const { Server, utils } = ssh2;
const { OPEN_MODE, STATUS_CODE } = utils.sftp;

/**
 * An SFTP server in the test process, serving a folder on disk, for publishing tests. It
 * understands what Lintel's uploads use: open, read, write, stat, mkdir, rename, remove.
 */
export async function startFakeSftpServer(options: {
  folder: string;
  username: string;
  password: string;
}): Promise<{ port: number; close: () => Promise<void> }> {
  const hostKey = utils.generateKeyPairSync("ed25519").private;
  const inside = (path: string) => {
    const resolved = normalize(join(options.folder, path.replace(/^\/+/, "")));
    if (!resolved.startsWith(normalize(join(options.folder, "..")))) throw new Error("outside");
    return resolved;
  };
  const server = new Server({ hostKeys: [hostKey] }, (client) => {
    client
      .on("authentication", (context) => {
        if (
          context.method === "password" &&
          context.username === options.username &&
          context.password === options.password
        ) {
          context.accept();
        } else {
          context.reject(["password"]);
        }
      })
      .on("ready", () => {
        client.on("session", (acceptSession) => {
          acceptSession().on("sftp", (acceptSftp) => {
            const sftp = acceptSftp();
            const handles = new Map<number, number>();
            let next = 0;
            const handleOf = (handle: Buffer) => handles.get(handle.readUInt32BE(0));
            const attempt = (reqid: number, work: () => void) => {
              try {
                work();
              } catch (error) {
                const code = (error as NodeJS.ErrnoException).code;
                sftp.status(
                  reqid,
                  code === "ENOENT" ? STATUS_CODE.NO_SUCH_FILE : STATUS_CODE.FAILURE,
                );
              }
            };
            const stat = (reqid: number, path: string) =>
              attempt(reqid, () => {
                const found = statSync(inside(path));
                sftp.attrs(reqid, {
                  mode: found.mode,
                  uid: 0,
                  gid: 0,
                  size: found.size,
                  atime: Math.floor(found.atimeMs / 1000),
                  mtime: Math.floor(found.mtimeMs / 1000),
                });
              });
            sftp
              .on("OPEN", (reqid, filename, flags) =>
                attempt(reqid, () => {
                  const writing = (flags & OPEN_MODE.WRITE) !== 0;
                  const descriptor = openSync(
                    inside(filename),
                    writing
                      ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC
                      : constants.O_RDONLY,
                  );
                  const handle = Buffer.alloc(4);
                  handle.writeUInt32BE(next, 0);
                  handles.set(next, descriptor);
                  next += 1;
                  sftp.handle(reqid, handle);
                }),
              )
              .on("READ", (reqid, handle, offset, length) =>
                attempt(reqid, () => {
                  const descriptor = handleOf(handle);
                  if (descriptor === undefined) throw new Error("no handle");
                  const buffer = Buffer.alloc(length);
                  const read = readSync(descriptor, buffer, 0, length, offset);
                  if (read === 0) sftp.status(reqid, STATUS_CODE.EOF);
                  else sftp.data(reqid, buffer.subarray(0, read));
                }),
              )
              .on("WRITE", (reqid, handle, offset, data) =>
                attempt(reqid, () => {
                  const descriptor = handleOf(handle);
                  if (descriptor === undefined) throw new Error("no handle");
                  writeSync(descriptor, data, 0, data.length, offset);
                  sftp.status(reqid, STATUS_CODE.OK);
                }),
              )
              .on("FSTAT", (reqid, handle) =>
                attempt(reqid, () => {
                  const descriptor = handleOf(handle);
                  if (descriptor === undefined) throw new Error("no handle");
                  const found = fstatSync(descriptor);
                  sftp.attrs(reqid, {
                    mode: found.mode,
                    uid: 0,
                    gid: 0,
                    size: found.size,
                    atime: 0,
                    mtime: 0,
                  });
                }),
              )
              .on("CLOSE", (reqid, handle) =>
                attempt(reqid, () => {
                  const descriptor = handleOf(handle);
                  if (descriptor !== undefined) closeSync(descriptor);
                  handles.delete(handle.readUInt32BE(0));
                  sftp.status(reqid, STATUS_CODE.OK);
                }),
              )
              .on("STAT", stat)
              .on("LSTAT", stat)
              .on("MKDIR", (reqid, path) =>
                attempt(reqid, () => {
                  mkdirSync(inside(path));
                  sftp.status(reqid, STATUS_CODE.OK);
                }),
              )
              .on("RENAME", (reqid, from, to) =>
                attempt(reqid, () => {
                  renameSync(inside(from), inside(to));
                  sftp.status(reqid, STATUS_CODE.OK);
                }),
              )
              .on("REMOVE", (reqid, path) =>
                attempt(reqid, () => {
                  unlinkSync(inside(path));
                  sftp.status(reqid, STATUS_CODE.OK);
                }),
              );
          });
        });
      });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
