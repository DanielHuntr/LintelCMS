import { HttpError } from "../http/http-errors.js";

export class PublishTargetNotFoundError extends HttpError {
  constructor() {
    super(404, "PUBLISH_TARGET_NOT_FOUND", "There's no publishing destination with that id.");
  }
}

export class PublishSiteNotFoundError extends HttpError {
  constructor() {
    super(404, "PUBLISH_SITE_NOT_FOUND", "That site doesn't exist any more. Choose another one.");
  }
}

export class PublishRunNotFoundError extends HttpError {
  constructor() {
    super(404, "PUBLISH_RUN_NOT_FOUND", "There's no publish with that id.");
  }
}

export class PrivateDestinationError extends HttpError {
  constructor(host: string) {
    super(
      400,
      "PRIVATE_DESTINATION",
      `${host} is a private or local address, so a live site can't publish there. Use the address your hosting gave you.`,
    );
  }
}

export class UnsafeFolderError extends HttpError {
  constructor(folder: string, reason: string) {
    super(400, "UNSAFE_FOLDER", `Lintel can't publish to ${folder}: ${reason}.`);
  }
}

export class FolderDestinationNeedsOwnerError extends HttpError {
  constructor() {
    super(
      403,
      "FOLDER_DESTINATION_NEEDS_OWNER",
      "Only an Owner can use a folder on this server, because it writes straight to the server's disk.",
    );
  }
}

export class PublishTargetIncompleteError extends HttpError {
  constructor(missing: string) {
    super(
      400,
      "PUBLISH_TARGET_INCOMPLETE",
      `This destination needs ${missing} before it can publish.`,
    );
  }
}

export class PublishAlreadyRunningError extends HttpError {
  constructor() {
    super(
      409,
      "PUBLISH_ALREADY_RUNNING",
      "This website is being published to this destination right now. Wait for it to finish.",
    );
  }
}

export class NotAZipTargetError extends HttpError {
  constructor() {
    super(400, "NOT_A_ZIP_TARGET", "Only “Download as ZIP” destinations can be downloaded.");
  }
}

/** A connection problem, in words someone setting up their hosting can act on. */
export class PublishConnectionError extends HttpError {
  constructor(message: string) {
    super(502, "PUBLISH_CONNECTION_FAILED", message);
  }
}

/**
 * Turns what SSH, FTP, S3 and the file system throw into a sentence. The original message
 * is kept at the end, for whoever helps.
 */
export function describeConnectionError(error: unknown, where: string): string {
  const details = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const text = `${code} ${details}`.toLowerCase();
  if (code === "ENOTFOUND" || text.includes("getaddrinfo")) {
    return `Lintel couldn't find ${where}. Check the server address for typos.`;
  }
  if (code === "ECONNREFUSED") {
    return `${where} refused the connection. Check the port, and that this kind of access (FTP or SFTP) is switched on in your hosting control panel.`;
  }
  if (code === "ETIMEDOUT" || text.includes("timed out") || text.includes("timeout")) {
    return `${where} didn't answer in time. Check the address and port; some hosts only allow connections from addresses you list in their control panel.`;
  }
  if (
    text.includes("authentication") ||
    text.includes("530") ||
    text.includes("login") ||
    text.includes("accessdenied") ||
    text.includes("signaturedoesnotmatch") ||
    text.includes("invalidaccesskeyid")
  ) {
    return `${where} turned down the username, password or key. Copy them again from your hosting control panel.`;
  }
  if (text.includes("certificate") || text.includes("tls") || text.includes("ssl")) {
    return `The secure connection to ${where} failed (${details}). Try "TLS from the start" or check the host's certificate.`;
  }
  if (
    code === "EACCES" ||
    code === "EPERM" ||
    text.includes("550") ||
    text.includes("permission denied")
  ) {
    return `${where} didn't let Lintel write there. Check the folder name and that the account may change files in it.`;
  }
  if (text.includes("nosuchbucket")) {
    return `There's no bucket with that name at ${where}.`;
  }
  return `Publishing to ${where} failed: ${details}`;
}
