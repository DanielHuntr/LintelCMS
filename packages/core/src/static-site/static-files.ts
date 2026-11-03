import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import { z } from "zod";

/**
 * Where each address goes in the exported folder, and the manifest that remembers what
 * was built from what. Addresses get clean folders: "/about" is `about/index.html`, which
 * every web server shows for "/about/" and, with the generated settings, for "/about".
 */

export const MANIFEST_FILE = ".lintel-manifest.json";
export const NOT_FOUND_FILE = "404.html";

/** The file an address is saved as, relative to the export folder, with "/" separators. */
export function fileForPath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (clean === "") return "index.html";
  const lastSegment = clean.split("/").at(-1) ?? "";
  // Files the site serves as they are (sitemap.xml, feed.xml, robots.txt) keep their name.
  if (/\.(xml|txt|json|css|js)$/i.test(lastSegment)) return clean;
  return `${clean}/index.html`;
}

/** A file's place inside the export folder, refusing anything that would leave it. */
export function resolveInside(folder: string, relativePath: string): string {
  const resolved = normalize(join(folder, relativePath));
  if (resolved !== folder && !resolved.startsWith(folder.endsWith(sep) ? folder : folder + sep)) {
    throw new Error(`"${relativePath}" is outside the export folder.`);
  }
  return resolved;
}

export function hashContent(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

const pageRecordSchema = z.object({
  signature: z.string(),
  files: z.array(z.string()),
  media: z.array(z.string()).default([]),
  search: z
    .object({ title: z.string(), url: z.string(), text: z.string() })
    .nullable()
    .default(null),
});

const manifestSchema = z.object({
  version: z.literal(1),
  pages: z.record(z.string(), pageRecordSchema),
  /** Every file in the export, with the SHA-256 of its contents. */
  files: z.record(z.string(), z.string()),
});

export type PageRecord = z.infer<typeof pageRecordSchema>;
export type StaticManifest = z.infer<typeof manifestSchema>;

export function emptyManifest(): StaticManifest {
  return { version: 1, pages: {}, files: {} };
}

/** The manifest of the last export into this folder; an empty one if there is none. */
export async function readManifest(folder: string): Promise<StaticManifest> {
  try {
    const parsed = manifestSchema.safeParse(
      JSON.parse(await readFile(join(folder, MANIFEST_FILE), "utf8")),
    );
    return parsed.success ? parsed.data : emptyManifest();
  } catch {
    return emptyManifest();
  }
}

export async function writeManifest(folder: string, manifest: StaticManifest): Promise<void> {
  await writeFile(join(folder, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
}

export async function writeExportFile(
  folder: string,
  relativePath: string,
  content: string | Uint8Array,
): Promise<void> {
  const target = resolveInside(folder, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function readExportFile(folder: string, relativePath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveInside(folder, relativePath));
  } catch {
    return null;
  }
}

export async function removeExportFile(folder: string, relativePath: string): Promise<void> {
  await rm(resolveInside(folder, relativePath), { force: true });
}
