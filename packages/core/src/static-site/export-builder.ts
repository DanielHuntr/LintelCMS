import type { FastifyInstance } from "fastify";
import type { SiteResponse } from "../website/rendered-pages-cache.js";
import {
  emptyManifest,
  fileForPath,
  hashContent,
  NOT_FOUND_FILE,
  type PageRecord,
  readExportFile,
  removeExportFile,
  type StaticManifest,
  writeExportFile,
  writeManifest,
} from "./static-files.js";
import {
  extensionFor,
  findMediaReferences,
  type MediaReference,
  rewriteMediaReferences,
} from "./static-media.js";
import { NOT_FOUND_PROBE, type PageJob } from "./static-pages.service.js";
import { searchRecordFor } from "./static-search.js";
import { redirectPage } from "./redirect-page.js";
import type { MediaFetcher, StaticExportResult } from "./static-export.service.js";

/** Keeps track of one export: what was written, what was kept, what goes. */
export class ExportBuilder {
  private readonly manifest: StaticManifest = emptyManifest();
  private readonly rebuilt: string[] = [];
  private readonly unchanged: string[] = [];
  private readonly warnings: string[] = [];

  constructor(
    private readonly folder: string,
    private readonly previous: StaticManifest,
    private readonly media: {
      publicApiUrl: string;
      siteAddress: string | null;
      fetchMedia: MediaFetcher;
    },
  ) {}

  has(file: string): boolean {
    return file in this.manifest.files;
  }

  hasMedia(): boolean {
    return Object.keys(this.manifest.files).some((file) => file.startsWith("media/"));
  }

  searchRecords() {
    return Object.values(this.manifest.pages).flatMap((page) => (page.search ? [page.search] : []));
  }

  async buildPage(
    job: PageJob & { signature: string },
    render: () => Promise<SiteResponse>,
  ): Promise<void> {
    const kept = this.previous.pages[job.path];
    if (kept && kept.signature === job.signature && (await this.stillIntact(kept))) {
      this.keep(job.path, kept);
      this.unchanged.push(job.path);
      return;
    }
    const response = await render();
    const isNotFoundPage = job.path === NOT_FOUND_PROBE;
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      await this.recordPage(
        job,
        fileForPath(job.path),
        redirectPage(response.headers.location),
        [],
      );
      return;
    }
    if (response.statusCode !== 200 && !isNotFoundPage) {
      return;
    }
    const body = String(response.body);
    const isHtml = (response.headers["content-type"] ?? "").startsWith("text/html");
    const { html, media } = isHtml ? await this.copyMedia(body) : { html: body, media: [] };
    const file = isNotFoundPage ? NOT_FOUND_FILE : fileForPath(job.path);
    await this.recordPage(job, file, html, media, isHtml && job.searchable === true);
  }

  async writeFile(file: string, content: string | Uint8Array): Promise<void> {
    const hash = hashContent(content);
    if (this.previous.files[file] !== hash || !(await this.fileMatches(file, hash))) {
      await writeExportFile(this.folder, file, content);
    }
    this.manifest.files[file] = hash;
  }

  async finish(): Promise<StaticExportResult> {
    const removed = Object.keys(this.previous.files).filter(
      (file) => !(file in this.manifest.files),
    );
    for (const file of removed) {
      await removeExportFile(this.folder, file);
    }
    await writeManifest(this.folder, this.manifest);
    return {
      rebuilt: this.rebuilt,
      unchanged: this.unchanged,
      removed,
      files: { ...this.manifest.files },
      warnings: this.warnings,
    };
  }

  private async recordPage(
    job: PageJob & { signature: string },
    file: string,
    content: string,
    media: string[],
    searchable = false,
  ): Promise<void> {
    await this.writeFile(file, content);
    this.manifest.pages[job.path] = {
      signature: job.signature,
      files: [file],
      media,
      search: searchable ? searchRecordFor(content, job.path) : null,
    };
    this.rebuilt.push(job.path);
  }

  private keep(path: string, record: PageRecord): void {
    this.manifest.pages[path] = record;
    for (const file of [...record.files, ...record.media]) {
      const hash = this.previous.files[file];
      if (hash) this.manifest.files[file] = hash;
    }
  }

  private async stillIntact(record: PageRecord): Promise<boolean> {
    for (const file of [...record.files, ...record.media]) {
      const hash = this.previous.files[file];
      if (!hash || !(await this.fileMatches(file, hash))) return false;
    }
    return true;
  }

  private async fileMatches(file: string, hash: string): Promise<boolean> {
    const existing = await readExportFile(this.folder, file);
    return existing !== null && hashContent(existing) === hash;
  }

  private async copyMedia(html: string): Promise<{ html: string; media: string[] }> {
    const saved = new Map<string, string>();
    for (const reference of findMediaReferences(html, this.media.publicApiUrl)) {
      const file = await this.saveMedia(reference);
      if (file) saved.set(reference.written, file);
    }
    return {
      html: rewriteMediaReferences(html, saved, this.media.siteAddress),
      media: [...new Set(saved.values())],
    };
  }

  private async saveMedia(reference: MediaReference): Promise<string | null> {
    const existing = Object.keys(this.manifest.files)
      .concat(Object.keys(this.previous.files))
      .find((file) => file.startsWith(`${reference.fileStem}.`));
    if (existing) {
      const hash = this.previous.files[existing] ?? this.manifest.files[existing];
      if (hash && (await this.fileMatches(existing, hash))) {
        this.manifest.files[existing] = hash;
        return existing;
      }
    }
    const fetched = await this.media.fetchMedia(reference.requestPath);
    if (!fetched) {
      this.warnings.push(
        `A picture (${reference.requestPath}) couldn't be copied, so that page links to Lintel for it.`,
      );
      return null;
    }
    const file = `${reference.fileStem}.${extensionFor(fetched.contentType)}`;
    await this.writeFile(file, fetched.body);
    return file;
  }
}

/** Asks the API in this process for a file, waiting when resizing is busy. */
export function injectMediaFetcher(api: FastifyInstance): MediaFetcher {
  const prefix = new URL(api.publicApiUrl).pathname.replace(/\/+$/, "");
  return async (requestPath) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await api.inject({ method: "GET", url: `${prefix}${requestPath}` });
      if (response.statusCode === 429) {
        const wait = Number(response.headers["retry-after"] ?? 5);
        await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 60) * 1000));
        continue;
      }
      if (response.statusCode !== 200) return null;
      return {
        body: response.rawPayload,
        contentType: String(response.headers["content-type"] ?? "application/octet-stream"),
      };
    }
    return null;
  };
}
