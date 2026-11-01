import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { basename, extname, join } from "node:path";
import { asc } from "drizzle-orm";
import type { Database } from "../database/client.js";
import { HttpError } from "../http/http-errors.js";
import type { StorageDriver } from "../media/storage-driver.js";
import { usersTable } from "../users/users.table.js";
import { findUserByEmail } from "../users/users.repository.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { bareHostname, isLocalHostName, isPrivateAddress } from "../webhooks/address-safety.js";
import { publicOnlyLookup } from "../webhooks/webhook-sender.js";
import { BackgroundTasks } from "../scheduler/background-tasks.js";
import {
  findImport as findWordPressImport,
  listItems as listWordPressItems,
} from "../wordpress-import/wordpress-import.repository.js";
import { buildReport } from "../wordpress-import/wordpress-import-report.js";
import {
  dryRunWordPressImport,
  runWordPressImport,
} from "../wordpress-import/wordpress-import-runner.js";
import { createWordPressImport } from "../wordpress-import/wordpress-import.service.js";
import { wordpressImportMappingSchema } from "../wordpress-import/wordpress-import.schema.js";
import { dryRunSiteImport, runSiteImport } from "./site-import-runner.js";
import { buildSiteReport } from "./site-import-report.js";
import { findImport, listItems } from "./site-import.repository.js";
import { importSources } from "./site-import.schema.js";
import { createSiteImport, describeSiteMappingChoices } from "./site-import.service.js";

/**
 * `lintel import <source> <file|url>...`: the same importers as Settings → Import, from the
 * terminal, with the suggested mapping. It runs in the foreground, so big sites can be
 * moved without a browser waiting; `--dry-run` reports what it would do and changes nothing.
 *
 * An address is downloaded first, with the same guard as pictures: never from the
 * server's own network, at most a few redirects, and no more than 64 MB.
 */
export const commandLineSources = ["wordpress", ...importSources] as const;
export type CommandLineSource = (typeof commandLineSources)[number];

export interface ImportFromFilesOptions {
  database: Database;
  storage: StorageDriver;
  importsFolder: string;
  publicApiUrl: string;
  source: CommandLineSource;
  /** Paths or https:// addresses: exports, CSV files, zips. */
  inputs: string[];
  dryRun: boolean;
  /** Who the import is recorded as; the first person here when left out. */
  asEmail?: string;
}

export interface ImportFromFilesResult {
  /** Counts of each kind: [what, done, left out, problems]. */
  counts: Array<[string, number, number, number]>;
  problems: string[];
  notes: string[];
  redirectsSuggested: number;
}

export class ImportInputError extends HttpError {
  constructor(message: string) {
    super(400, "IMPORT_INPUT", message);
  }
}

const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;

export async function importFromFiles(
  options: ImportFromFilesOptions,
): Promise<ImportFromFilesResult> {
  await mkdir(options.importsFolder, { recursive: true });
  const startedBy = await whoIsImporting(options.database, options.asEmail);
  const local = await Promise.all(
    options.inputs.map((input) => toLocalFile(input, options.importsFolder)),
  );
  const runner = {
    database: options.database,
    storage: options.storage,
    publicApiUrl: options.publicApiUrl,
    importsFolder: options.importsFolder,
    download: { allowPrivateAddresses: false },
  };
  const tasks = new BackgroundTasks(() => undefined);
  try {
    if (options.source === "wordpress") {
      return await importWordPress(options, runner, tasks, local, startedBy);
    }
    const archive = local.find((file) => extname(file.name).toLowerCase() === ".zip");
    let archiveFile: string | null = null;
    if (archive) {
      archiveFile = `${options.source}-site-${Date.now()}.zip`;
      await copyFile(archive.path, join(options.importsFolder, archiveFile));
    }
    const files = [];
    for (const file of local.filter((candidate) => candidate !== archive)) {
      files.push({ filename: file.name, text: await readFile(file.path, "utf8") });
    }
    const created = await createSiteImport(
      { ...runner, tasks },
      {
        source: options.source,
        filename: local[0]?.name ?? options.source,
        files,
        archiveFile,
        startedBy,
      },
    );
    const choices = await describeSiteMappingChoices({ ...runner, tasks }, created.id);
    const row = await findImport(options.database, DEFAULT_TENANT_ID, created.id);
    if (!row) throw new Error("The import wasn't saved.");
    let report;
    try {
      if (options.dryRun) {
        report = await dryRunSiteImport(runner, row, choices.suggested);
      } else {
        await runSiteImport(runner, row, choices.suggested);
        report = buildSiteReport(await listItems(options.database, row.id), false, row.found.notes);
      }
    } finally {
      if (archiveFile) await rm(join(options.importsFolder, archiveFile), { force: true });
    }
    return {
      counts: Object.entries(report.counts).map(([kind, count]) => [
        kind,
        count.done,
        count.skipped,
        count.failed,
      ]),
      problems: report.problems.map((problem) => `${problem.title}: ${problem.message}`),
      notes: report.notes,
      redirectsSuggested: report.redirectsSuggested,
    };
  } finally {
    await Promise.all(
      local.filter((file) => file.downloaded).map((file) => rm(file.path, { force: true })),
    );
  }
}

async function importWordPress(
  options: ImportFromFilesOptions,
  runner: Parameters<typeof runWordPressImport>[0],
  tasks: BackgroundTasks,
  local: LocalFile[],
  startedBy: string,
): Promise<ImportFromFilesResult> {
  const exportFile = local.find((file) => extname(file.name).toLowerCase() === ".xml");
  if (!exportFile)
    throw new ImportInputError("Give the WordPress export, the .xml file from Tools → Export.");
  const zip = local.find((file) => extname(file.name).toLowerCase() === ".zip");
  let contentZipFile: string | null = null;
  if (zip) {
    contentZipFile = `wordpress-content-${Date.now()}.zip`;
    await copyFile(zip.path, join(options.importsFolder, contentZipFile));
  }
  const created = await createWordPressImport(
    { ...runner, tasks },
    {
      filename: exportFile.name,
      xml: await readFile(exportFile.path, "utf8"),
      contentZipFile,
      startedBy,
    },
  );
  const row = await findWordPressImport(options.database, DEFAULT_TENANT_ID, created.id);
  if (!row) throw new Error("The import wasn't saved.");
  const mapping = wordpressImportMappingSchema.parse({ media: zip ? "zip" : "download" });
  let report;
  try {
    if (options.dryRun) {
      report = await dryRunWordPressImport(runner, row, mapping);
    } else {
      await runWordPressImport(runner, row, mapping);
      report = buildReport(await listWordPressItems(options.database, row.id), false);
    }
  } finally {
    if (contentZipFile) await rm(join(options.importsFolder, contentZipFile), { force: true });
  }
  return {
    counts: Object.entries(report.counts).map(([kind, count]) => [
      kind,
      count.done,
      count.skipped,
      count.failed,
    ]),
    problems: report.problems.map((problem) => `${problem.title}: ${problem.message}`),
    notes: [],
    redirectsSuggested: report.redirectsSuggested,
  };
}

async function whoIsImporting(database: Database, email: string | undefined): Promise<string> {
  if (email) {
    const user = await findUserByEmail(database, DEFAULT_TENANT_ID, email.toLowerCase());
    if (!user) throw new ImportInputError(`Nobody here has the email ${email}.`);
    return user.id;
  }
  const [first] = await database
    .select({ id: usersTable.id })
    .from(usersTable)
    .orderBy(asc(usersTable.createdAt))
    .limit(1);
  if (!first)
    throw new ImportInputError(
      "Finish setting Lintel up first: an import needs someone to belong to.",
    );
  return first.id;
}

interface LocalFile {
  path: string;
  name: string;
  downloaded: boolean;
}

async function toLocalFile(input: string, folder: string): Promise<LocalFile> {
  if (!/^https?:\/\//i.test(input)) {
    try {
      await stat(input);
    } catch {
      throw new ImportInputError(`There is no file at ${input}.`);
    }
    return { path: input, name: basename(input), downloaded: false };
  }
  const body = await download(input);
  const name = basename(new URL(input).pathname) || "download";
  const extension = extname(name)
    ? ""
    : body.type.includes("json")
      ? ".json"
      : body.type.includes("xml")
        ? ".xml"
        : ".html";
  const path = join(folder, `download-${Date.now()}-${name}${extension}`);
  await writeFile(path, body.contents);
  return { path, name: `${name}${extension}`, downloaded: true };
}

async function download(address: string): Promise<{ contents: Buffer; type: string }> {
  let current = address;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const url = new URL(current);
    const host = bareHostname(url);
    if (isLocalHostName(host) || (isIP(host) !== 0 && isPrivateAddress(host))) {
      throw new ImportInputError(`${host} is a private or local address, so it wasn't downloaded.`);
    }
    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const send = url.protocol === "https:" ? httpsRequest : httpRequest;
      const outgoing = send(url, { timeout: 30_000, lookup: publicOnlyLookup }, resolve);
      outgoing.on("timeout", () =>
        outgoing.destroy(new ImportInputError(`${host} took too long to answer.`)),
      );
      outgoing.on("error", reject);
      outgoing.end();
    });
    const status = response.statusCode ?? 0;
    if (status >= 300 && status < 400 && response.headers.location) {
      response.resume();
      current = new URL(response.headers.location, current).toString();
      continue;
    }
    if (status !== 200) {
      response.resume();
      throw new ImportInputError(`${host} answered ${status} for ${address}.`);
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += (chunk as Buffer).length;
      if (size > MAX_DOWNLOAD_BYTES) {
        response.destroy();
        throw new ImportInputError(
          `${address} is bigger than 64 MB. Download it and give the file instead.`,
        );
      }
      chunks.push(chunk as Buffer);
    }
    return {
      contents: Buffer.concat(chunks),
      type: String(response.headers["content-type"] ?? ""),
    };
  }
  throw new ImportInputError(`${address} redirected too many times.`);
}
