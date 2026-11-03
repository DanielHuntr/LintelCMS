import { PublishTargetIncompleteError } from "./publishing.errors.js";
import type { PublishTargetSecrets } from "./publishing.schema.js";
import type { PublishTargetRow } from "./publishing.table.js";
import { openFolderRemote } from "./remotes/folder-remote.js";
import { openFtpRemote } from "./remotes/ftp-remote.js";
import type { RemoteFolder } from "./remotes/remote-folder.js";
import { openS3Remote } from "./remotes/s3-remote.js";
import { openSftpRemote } from "./remotes/sftp-remote.js";

/** Opens the right kind of connection for a target, after checking nothing is missing. */
export async function openTargetRemote(
  target: Pick<PublishTargetRow, "kind" | "options">,
  secrets: PublishTargetSecrets,
  testing: { allowSelfSignedCertificate?: boolean } = {},
): Promise<RemoteFolder> {
  const { options } = target;
  const need = (value: string | number | undefined, what: string) => {
    if (value === undefined || value === "") throw new PublishTargetIncompleteError(what);
    return value;
  };
  switch (target.kind) {
    case "folder":
      return openFolderRemote(String(need(options.folderPath, "a folder")));
    case "sftp":
      if (!secrets.password && !secrets.privateKey) {
        throw new PublishTargetIncompleteError("a password or a private key");
      }
      return openSftpRemote({
        host: String(need(options.host, "the server's address")),
        port: options.port ?? 22,
        username: String(need(options.username, "a username")),
        password: secrets.password,
        privateKey: secrets.privateKey,
        remoteFolder: options.remoteFolder ?? "",
      });
    case "ftp":
      return openFtpRemote({
        host: String(need(options.host, "the server's address")),
        port: options.port ?? 21,
        username: String(need(options.username, "a username")),
        password: String(need(secrets.password, "a password")),
        remoteFolder: options.remoteFolder ?? "",
        security: options.ftpSecurity ?? "explicit",
        allowSelfSignedCertificate: testing.allowSelfSignedCertificate,
      });
    case "s3":
      return openS3Remote({
        bucket: String(need(options.bucket, "a bucket name")),
        region: options.region ?? "",
        endpoint: options.endpoint || undefined,
        prefix: options.prefix ?? "",
        accessKeyId: String(need(secrets.accessKeyId, "an access key id")),
        secretAccessKey: String(need(secrets.secretAccessKey, "a secret access key")),
      });
    case "zip":
      throw new PublishTargetIncompleteError(
        "somewhere to upload to (ZIPs are downloaded instead)",
      );
  }
}

/** Where a target publishes, in words: "ftp.example.com" or "the bucket my-site". */
export function targetLocation(target: Pick<PublishTargetRow, "kind" | "options">): string {
  const { options } = target;
  switch (target.kind) {
    case "folder":
      return `the folder ${options.folderPath ?? ""}`;
    case "s3":
      return `the bucket ${options.bucket ?? ""}`;
    case "zip":
      return "a ZIP file";
    default:
      return options.host ?? "the server";
  }
}
