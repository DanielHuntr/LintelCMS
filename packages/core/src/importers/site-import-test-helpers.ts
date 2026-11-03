import { readdir, readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { join, relative } from "node:path";
import yazl from "yazl";
import { expect } from "vitest";
import { multipartFiles } from "../testing/multipart.js";
import type { useDataToolsTestServer } from "../testing/test-data-tools.js";
import type { SiteImportReport } from "./site-import.schema.js";

/** Helpers for the importers' tests: zipping a fixture folder, uploading, running. */
type Tools = ReturnType<typeof useDataToolsTestServer>;

export const fixturesFolder = join(import.meta.dirname, "fixtures");

/** A zip of a fixture folder, with extra files (pictures made in the test) added. */
export async function zipFolder(
  folder: string,
  extra: Record<string, Buffer> = {},
  prefix = "",
): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const path of await listFiles(folder)) {
    zip.addBuffer(await readFile(path), `${prefix}${relative(folder, path)}`);
  }
  for (const [name, contents] of Object.entries(extra)) zip.addBuffer(contents, name);
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function listFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? listFiles(join(folder, entry.name))
        : Promise.resolve([join(folder, entry.name)]),
    ),
  );
  return nested.flat().sort();
}

export interface Upload {
  files?: Array<{ filename: string; contents: Buffer }>;
  archive?: Buffer;
}

export async function uploadImport(tools: Tools, source: string, upload: Upload) {
  const response = await tools.server.inject({
    method: "POST",
    url: `/site-imports/${source}`,
    cookies: tools.cookies,
    ...multipartFiles([
      ...(upload.files ?? []).map((file, index) => ({
        fieldName: `files-${index + 1}`,
        filename: file.filename,
        contents: file.contents,
      })),
      ...(upload.archive
        ? [{ fieldName: "archive", filename: "site.zip", contents: upload.archive }]
        : []),
    ]),
  });
  expect(response.statusCode, response.body).toBe(201);
  return response.json<{ id: string; found: Record<string, unknown> & { notes: string[] } }>();
}

export async function mappingChoices(tools: Tools, importId: string) {
  return (await tools.api("GET", `/site-imports/${importId}/mapping`)).json<{
    suggested: Record<string, unknown> & {
      contentTypes: Record<
        string,
        { collection: string | null; create: boolean; fields: Record<string, string | null> }
      >;
    };
  }>();
}

/** Starts the import and waits for it, returning the finished import with its report. */
export async function runImport(tools: Tools, importId: string) {
  const started = await tools.api("POST", `/site-imports/${importId}/start`);
  expect(started.statusCode, started.body).toBe(202);
  await tools.server.dataTools.tasks.finishAll();
  return (await tools.api("GET", `/site-imports/${importId}`)).json<{
    status: string;
    progress: { done: number; total: number };
    report: SiteImportReport;
  }>();
}

export async function entriesIn(tools: Tools, collection: string) {
  const response = await tools.api("GET", `/collections/${collection}/entries?perPage=100`);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{
    entries: Array<{
      id: string;
      title: string;
      slug: string;
      status: string;
      parentId: string | null;
    }>;
  }>().entries;
}

export async function entryData(tools: Tools, entryId: string | undefined) {
  return (await tools.api("GET", `/entries/${entryId}`)).json<{
    data: Record<string, unknown>;
    publishedAt: string | null;
  }>();
}

/**
 * A small web server on this machine standing in for an old site's picture CDN, so tests
 * never fetch anything real. It answers every path with the picture given.
 */
export async function startPictureServer(picture: Buffer): Promise<{
  server: Server;
  address: string;
  requests: string[];
}> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.writeHead(200, { "content-type": "image/png", "content-length": picture.length });
    response.end(picture);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return { server, address: `http://127.0.0.1:${port}`, requests };
}
