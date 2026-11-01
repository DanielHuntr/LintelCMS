import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { HttpError } from "../http/http-errors.js";
import { getAsset, updateAsset, uploadAsset } from "../media/media.service.js";
import { slugify } from "../entries/slugs.js";
import { findUserByEmail, insertUser } from "../users/users.repository.js";
import {
  done,
  failed,
  type ItemContext,
  type ItemResult,
  skipped,
} from "./wordpress-import-context.js";
import { MediaNotAllowedError } from "./wordpress-import.errors.js";
import type { MediaSource } from "./wordpress-media.js";
import { findTermInTaxonomy, insertTerm } from "./wordpress-import.repository.js";

/**
 * Bringing in the things posts point at: authors, categories and tags, and files. Posts
 * and pages are in wordpress-entries.ts. Each handler returns how it went rather than
 * throwing, so one bad item never stops an import.
 */

export interface AuthorPayload {
  login: string;
  email: string;
  displayName: string;
}

/**
 * The old site's authors become people in Lintel without a password: they can't sign in
 * until they are given one, and no WordPress password ever reaches Lintel. Someone who is
 * already here (same email) is used as they are.
 */
export async function importAuthor(
  context: ItemContext,
  author: AuthorPayload,
): Promise<ItemResult> {
  if (context.mapping.authors === "skip") {
    return skipped("Authors were left out on the mapping screen.");
  }
  if (!author.email) {
    return skipped(`${author.displayName} has no email address in the export.`);
  }
  const existing = await findUserByEmail(context.database, DEFAULT_TENANT_ID, author.email);
  if (existing) {
    return done(existing.id, { alreadyHere: true });
  }
  const user = await insertUser(context.database, {
    email: author.email,
    name: author.displayName || author.login,
    passwordHash: null,
  });
  return done(user.id, { invited: true, name: user.name, email: user.email });
}

export interface TermPayload {
  slug: string;
  name: string;
}

export async function importTerm(
  context: ItemContext,
  taxonomyHandle: string | null,
  term: TermPayload,
): Promise<ItemResult> {
  if (taxonomyHandle === null) {
    return skipped("This taxonomy was left out on the mapping screen.");
  }
  const slug = slugify(safeDecode(term.slug)) || slugify(term.name);
  const found = await findTermInTaxonomy(context.database, DEFAULT_TENANT_ID, taxonomyHandle, slug);
  if (!found) {
    return failed(`The taxonomy “${taxonomyHandle}” no longer exists.`);
  }
  if (found.id) {
    return done(found.id, { alreadyHere: true });
  }
  const termId = await insertTerm(context.database, {
    taxonomyId: found.taxonomyId,
    title: term.name || slug,
    slug,
  });
  return done(termId);
}

export interface FilePayload {
  url: string;
  title: string;
  alt: string;
}

/** Brings one file into the media library. The same file twice gives the same asset. */
export async function importFile(context: ItemContext, file: FilePayload): Promise<ItemResult> {
  if (!context.media) {
    return skipped("Images were left out on the mapping screen.");
  }
  if (context.dryRun) {
    return checkFile(context.media, file.url);
  }
  let contents: Buffer;
  try {
    contents = await context.media.fetch(file.url);
  } catch (error) {
    if (error instanceof MediaNotAllowedError) {
      return failed(`Not brought in: ${error.message}.`);
    }
    throw error;
  }
  const media = context.mediaContext(context.database);
  try {
    const filename = safeDecode(basename(new URL(file.url).pathname)) || "image";
    const { asset } = await uploadAsset(media, { filename, contents }, context.startedBy);
    if (file.alt && !asset.alt) {
      await updateAsset(media, asset.id, { alt: file.alt.slice(0, 500) });
    }
    return done(asset.id, { url: asset.url });
  } catch (error) {
    // The media library refused it (not really an image, an unsafe SVG...): say why.
    if (error instanceof HttpError) {
      return failed(error.message);
    }
    throw error;
  }
}

/** A dry run checks what it can without downloading, and pretends the file came in. */
async function checkFile(media: MediaSource, url: string): Promise<ItemResult> {
  try {
    await media.check(url);
    return done(randomUUID(), { url });
  } catch (error) {
    if (error instanceof MediaNotAllowedError) {
      return failed(`Won't be brought in: ${error.message}.`);
    }
    throw error;
  }
}

/** The media library address of an asset, for images inside rich text. */
export async function assetAddress(context: ItemContext, assetId: string): Promise<string> {
  if (context.dryRun) {
    return `/media/${assetId}/file`;
  }
  return (await getAsset(context.mediaContext(context.database), assetId)).url;
}

/** WordPress keeps non-English slugs percent-encoded ("caf%c3%a9"). */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
