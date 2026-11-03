import { totalmem } from "node:os";
import { downloadModel, type Fetch } from "./model-download.js";
import type { ModelFiles } from "./model-files.repository.js";
import { ModelBusyError, NotEnoughDiskError } from "./page-drafts.errors.js";
import { modelSizeInBytes } from "./writing-model.js";

/** Kept free beside the model, so the disk is never filled to the last byte. */
const DISK_MARGIN_IN_BYTES = 512 * 1024 ** 2;

export type ModelState =
  "not-installed" | "paused" | "downloading" | "checking" | "installed" | "failed";

export interface ModelStatus {
  state: ModelState;
  model: {
    name: string;
    maker: string;
    licence: string;
    licenceUrl: string;
    sourcePage: string;
    files: Array<{ name: string; url: string; sizeInBytes: number; sha256: string }>;
    sizeInBytes: number;
    memoryNeededInBytes: number;
  };
  /** Where the files go on this server, for people who copy them in themselves. */
  folder: string;
  bytesOnDisk: number;
  /** Why the last download or check failed, in plain words. */
  problem: string | null;
  server: {
    totalMemoryInBytes: number;
    freeDiskInBytes: number;
    hasEnoughMemory: boolean;
    hasEnoughDisk: boolean;
  };
}

export interface ModelSetupOptions {
  fetch?: Fetch;
  /** The server's memory; the real figure unless a test says otherwise. */
  totalMemoryInBytes?: () => number;
}

/**
 * Setting up the writing model on this server: downloading it (cancel and resume), checking
 * files someone copied in, and removing it. One per server, since the files are the server's,
 * whichever site asks. Work runs in the background; the admin asks for the status.
 */
export class ModelSetup {
  private work: { kind: "downloading" | "checking"; controller: AbortController } | null = null;
  private bytesSoFar = 0;
  private problem: string | null = null;
  /** The last download or check, for tests to wait on. */
  finished: Promise<void> = Promise.resolve();

  constructor(
    readonly files: ModelFiles,
    private readonly options: ModelSetupOptions = {},
  ) {}

  async status(): Promise<ModelStatus> {
    const { model } = this.files;
    const size = modelSizeInBytes(model);
    const installed = !this.work && (await this.files.isInstalled());
    const bytesOnDisk = this.work ? this.bytesSoFar : await this.countBytesOnDisk();
    const freeDisk = await this.files.freeDiskBytes();
    const totalMemory = (this.options.totalMemoryInBytes ?? totalmem)();
    const state: ModelState = this.work
      ? this.work.kind
      : installed
        ? "installed"
        : this.problem
          ? "failed"
          : bytesOnDisk > 0
            ? "paused"
            : "not-installed";
    return {
      state,
      model: {
        name: model.name,
        maker: model.maker,
        licence: model.licence,
        licenceUrl: model.licenceUrl,
        sourcePage: model.sourcePage,
        files: model.files.map((file) => ({ ...file })),
        sizeInBytes: size,
        memoryNeededInBytes: model.memoryNeededInBytes,
      },
      folder: this.files.folder,
      bytesOnDisk,
      problem: this.problem,
      server: {
        totalMemoryInBytes: totalMemory,
        freeDiskInBytes: freeDisk,
        hasEnoughMemory: totalMemory >= model.memoryNeededInBytes,
        hasEnoughDisk: installed || freeDisk >= size - bytesOnDisk + DISK_MARGIN_IN_BYTES,
      },
    };
  }

  /** Starts (or resumes) the download in the background. */
  async startDownload(): Promise<void> {
    if (this.work) throw new ModelBusyError();
    const size = modelSizeInBytes(this.files.model);
    const onDisk = await this.countBytesOnDisk();
    const freeDisk = await this.files.freeDiskBytes();
    if (freeDisk < size - onDisk + DISK_MARGIN_IN_BYTES) {
      throw new NotEnoughDiskError(size - onDisk + DISK_MARGIN_IN_BYTES, freeDisk);
    }
    this.begin("downloading", (signal) =>
      downloadModel({
        files: this.files,
        signal,
        fetch: this.options.fetch,
        onProgress: (bytes) => {
          this.bytesSoFar = bytes;
        },
      }),
    );
  }

  /** "I'll copy the file in myself": checks whatever is in the folder now. */
  async startCheck(): Promise<void> {
    if (this.work) throw new ModelBusyError();
    this.begin("checking", async () => {
      const { files } = this;
      await files.forgetChecked();
      for (const file of files.model.files) {
        const onDisk = await files.bytesOnDisk(file);
        if (onDisk.whole !== file.sizeInBytes) {
          throw new Error(
            onDisk.whole === 0
              ? `${file.name} isn't in the folder yet.`
              : `${file.name} is a different size from the published file.`,
          );
        }
        if ((await files.checksumOf(files.pathOf(file))) !== file.sha256) {
          throw new Error(`${file.name} isn't the file the model's makers published.`);
        }
      }
      await files.recordChecked();
    });
  }

  /** Stops a download, keeping what has arrived so it can resume. */
  cancel(): void {
    this.work?.controller.abort(new Error("Cancelled"));
  }

  async remove(): Promise<void> {
    if (this.work) {
      this.cancel();
      await this.finished;
    }
    this.problem = null;
    await this.files.removeAll();
  }

  private begin(kind: "downloading" | "checking", run: (signal: AbortSignal) => Promise<void>) {
    const controller = new AbortController();
    this.work = { kind, controller };
    this.problem = null;
    this.finished = run(controller.signal)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          this.problem = error instanceof Error ? error.message : String(error);
        }
      })
      .finally(() => {
        this.work = null;
      });
  }

  private async countBytesOnDisk(): Promise<number> {
    let total = 0;
    for (const file of this.files.model.files) {
      const onDisk = await this.files.bytesOnDisk(file);
      total += onDisk.whole > 0 ? onDisk.whole : onDisk.part;
    }
    return total;
  }
}
