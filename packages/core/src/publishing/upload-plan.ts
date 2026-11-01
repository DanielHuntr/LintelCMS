import { z } from "zod";

/**
 * What a publish has to change on the host: files that are new or different, and files
 * Lintel put there before that the site no longer has. Lintel keeps a list of what it
 * uploaded on the host itself (`.lintel-published.json`), so it only ever deletes its own
 * files, never something put there by hand.
 */

export const REMOTE_MANIFEST_FILE = ".lintel-published.json";

const remoteManifestSchema = z.object({
  version: z.literal(1),
  files: z.record(z.string(), z.string()),
  privateFiles: z.record(z.string(), z.string()).default({}),
});

export type RemoteManifest = z.infer<typeof remoteManifestSchema>;

export function readRemoteManifest(content: Buffer | null): RemoteManifest {
  if (!content) return { version: 1, files: {}, privateFiles: {} };
  try {
    const parsed = remoteManifestSchema.safeParse(JSON.parse(content.toString("utf8")));
    return parsed.success ? parsed.data : { version: 1, files: {}, privateFiles: {} };
  } catch {
    return { version: 1, files: {}, privateFiles: {} };
  }
}

export interface UploadPlan {
  upload: string[];
  delete: string[];
  unchanged: number;
  /** Deletions over the target's limit, held back until someone confirms. */
  deletionsHeld: string[];
}

export function planUpload(
  local: Readonly<Record<string, string>>,
  remote: Readonly<Record<string, string>>,
  options: { deleteLimit: number; confirmDeletions: boolean },
): UploadPlan {
  const upload = Object.keys(local)
    .filter((file) => remote[file] !== local[file])
    .sort(uploadOrder);
  const removed = Object.keys(remote)
    .filter((file) => !(file in local))
    .sort();
  const tooMany = removed.length > options.deleteLimit && !options.confirmDeletions;
  return {
    upload,
    delete: tooMany ? [] : removed,
    deletionsHeld: tooMany ? removed : [],
    unchanged: Object.keys(local).length - upload.length,
  };
}

/**
 * Pictures, styles and scripts first, pages after them and server settings last, so a new
 * page never goes up before what it shows.
 */
function uploadOrder(first: string, second: string): number {
  return rank(first) - rank(second) || first.localeCompare(second);
}

function rank(file: string): number {
  if (file === ".htaccess" || file === "web.config") return 3;
  if (file.endsWith(".html") || file.endsWith(".xml") || file.endsWith(".txt")) return 2;
  if (file.endsWith(".php")) return 1;
  return 0;
}
