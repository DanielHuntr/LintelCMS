import { EventEmitter } from "node:events";
import { DEFAULT_UPDATE_FEED_URL } from "./update-feed.js";
import { currentInstallFacts, detectInstallType, updateMethodFor } from "./install-type.js";
import { lintelVersion } from "./lintel-version.js";
import { LINTEL_RELEASE_PUBLIC_KEY } from "./release-public-key.js";
import type { SwitchRequest } from "./supervisor/supervisor-messages.js";
import { switchRequestMessage } from "./supervisor/supervisor-messages.js";
import type { InstallType, UpdateMethod, UpdateProgress } from "./updates.schema.js";
import { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";

/** What `buildServer` is told about updates. Every part has a default. */
export interface UpdatesOptions {
  /** Look for new versions at all (UPDATE_CHECKS). Defaults to on. */
  checksEnabled?: boolean;
  feedUrl?: string;
  /** minisign public key the downloads must be signed with (UPDATE_PUBLIC_KEY). */
  publicKey?: string;
  /** Defaults to what install-type.ts works out. */
  installType?: InstallType;
  /** Where versions/ is, for supervised installs (LINTEL_HOME). */
  home?: string;
  /** The folder with lintel.config.ts and packages/ in it. */
  installFolder?: string;
  /** The running version; tests pretend to be older. */
  currentVersion?: string;
  fetch?: typeof fetch;
  /** Tells the supervisor to switch versions. Defaults to Node's IPC channel to it. */
  sendToSupervisor?: (request: SwitchRequest) => void;
  /** The opt-in lintel-updater service, for Docker installs. */
  dockerUpdater?: { url: string; token: string } | null;
  /** Unpacks a release; tests pass one that doesn't need `tar`. */
  unpack?: (archive: string, into: string) => Promise<void>;
}

/**
 * Everything about updates the server keeps while it runs: the settings above, filled in,
 * and the update in progress, which the admin follows live.
 */
export class UpdatesRuntime {
  readonly checksEnabled: boolean;
  readonly feedUrl: string;
  readonly publicKey: string;
  readonly installType: InstallType;
  readonly home: string;
  readonly installFolder: string;
  readonly currentVersion: string;
  readonly fetch: typeof fetch;
  readonly dockerUpdater: { url: string; token: string } | null;
  readonly unpack: ((archive: string, into: string) => Promise<void>) | undefined;
  private readonly sendRequest: ((request: SwitchRequest) => void) | null;
  private progress: UpdateProgress | null = null;
  private readonly changes = new EventEmitter();

  constructor(options: UpdatesOptions = {}) {
    this.installFolder = options.installFolder ?? REPOSITORY_ROOT;
    this.checksEnabled = options.checksEnabled ?? true;
    this.feedUrl = options.feedUrl ?? DEFAULT_UPDATE_FEED_URL;
    this.publicKey = options.publicKey ?? LINTEL_RELEASE_PUBLIC_KEY;
    this.installType =
      options.installType ?? detectInstallType(currentInstallFacts(this.installFolder));
    this.home = options.home ?? process.env.LINTEL_HOME ?? this.installFolder;
    this.currentVersion = options.currentVersion ?? lintelVersion();
    this.fetch = options.fetch ?? fetch;
    this.dockerUpdater = options.dockerUpdater ?? null;
    this.unpack = options.unpack;
    this.sendRequest = options.sendToSupervisor ?? supervisorChannel();
    this.changes.setMaxListeners(100);
  }

  get feedIsDefault(): boolean {
    return this.feedUrl === DEFAULT_UPDATE_FEED_URL;
  }

  get method(): UpdateMethod {
    // Without the supervisor on the other end of the channel, the button can't work.
    const installType =
      this.installType === "supervised" && !this.sendRequest ? "process" : this.installType;
    return updateMethodFor(installType, { dockerUpdaterAvailable: this.dockerUpdater !== null });
  }

  get currentProgress(): UpdateProgress | null {
    return this.progress;
  }

  /** True from the backup until the supervisor takes over (or it fails before then). */
  get isBusy(): boolean {
    return this.progress !== null && this.progress.finishedAt === null;
  }

  report(progress: UpdateProgress): void {
    this.progress = progress;
    this.changes.emit("progress", progress);
  }

  onProgress(listener: (progress: UpdateProgress) => void): () => void {
    this.changes.on("progress", listener);
    return () => this.changes.off("progress", listener);
  }

  askSupervisor(request: SwitchRequest): void {
    if (!this.sendRequest) {
      throw new Error("Lintel wasn't started with `lintel start`, so nothing can switch versions");
    }
    this.sendRequest(request);
  }
}

/** The IPC channel to the supervisor, when `lintel start` started this process. */
function supervisorChannel(): ((request: SwitchRequest) => void) | null {
  if (process.env.LINTEL_SUPERVISED !== "1" || typeof process.send !== "function") {
    return null;
  }
  return (request) => {
    process.send?.(switchRequestMessage(request));
  };
}
