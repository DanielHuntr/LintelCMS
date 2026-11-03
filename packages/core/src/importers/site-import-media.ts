import { extname } from "node:path";
import type { ZipArchiveReader } from "../archives/zip-reader.js";
import {
  allowedMediaExtensions,
  allowedMediaHosts,
  type DownloadOptions,
  downloadingMediaSource,
  MAX_MEDIA_BYTES,
  type MediaSource,
} from "../wordpress-import/wordpress-media.js";
import { MAX_UPLOAD_MEGABYTES } from "../media/media.errors.js";
import { MediaNotAllowedError } from "../wordpress-import/wordpress-import.errors.js";

/**
 * Where pictures come from while a site import runs: the uploaded zip ("archive:" plus the
 * path inside it), or downloaded from the old site. Downloads follow the WordPress
 * importer's rules (src/wordpress-import/wordpress-media.ts): only the old site's own
 * address, its CDN and hosts added on the mapping screen, checked again after every
 * redirect; never an address on the server's own network; only picture and PDF types, up
 * to the media library's size limit.
 */
export const ARCHIVE_PREFIX = "archive:";

export function siteMediaSource(options: {
  archive: ZipArchiveReader | undefined;
  download: DownloadOptions;
  siteAddress: string;
  hosts: readonly string[];
}): MediaSource {
  const downloads = downloadingMediaSource(
    options.download,
    allowedMediaHosts(options.siteAddress, options.hosts),
  );
  const inArchive = (address: string): string => {
    const path = address.slice(ARCHIVE_PREFIX.length);
    const extension = extname(path).toLowerCase();
    if (!allowedMediaExtensions.includes(extension)) {
      throw new MediaNotAllowedError(
        `${extension || "files without an extension"} isn't a file type Lintel imports`,
      );
    }
    if (!options.archive?.has(path)) {
      throw new MediaNotAllowedError(`${path} isn't in the uploaded zip`);
    }
    if ((options.archive.sizeOf(path) ?? 0) > MAX_MEDIA_BYTES) {
      throw new MediaNotAllowedError(`it is bigger than ${MAX_UPLOAD_MEGABYTES} MB`);
    }
    return path;
  };
  return {
    async check(address) {
      if (address.startsWith(ARCHIVE_PREFIX)) {
        inArchive(address);
      } else {
        await downloads.check(address);
      }
    },
    async fetch(address) {
      if (!address.startsWith(ARCHIVE_PREFIX)) {
        return downloads.fetch(address);
      }
      const path = inArchive(address);
      if (!options.archive) {
        throw new MediaNotAllowedError("no zip was uploaded");
      }
      return options.archive.readBuffer(path);
    },
  };
}
