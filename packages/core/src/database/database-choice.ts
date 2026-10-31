import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * The database picked on the setup screen, saved in .lintel/config.json so the next
 * start uses it too. The order on start is: DATABASE_URL, then this file, then the
 * built-in database.
 */

export const postgresConnectionDetailsSchema = z.object({
  host: z
    .string({ error: "Please enter the server's address" })
    .trim()
    .min(1, { error: "Please enter the server's address" })
    .refine((host) => !/[\s/@]/.test(host), {
      error: "The server address should be a name like localhost or db.example.com",
    }),
  port: z.coerce
    .number({ error: "The port should be a number, usually 5432" })
    .int({ error: "The port should be a whole number, usually 5432" })
    .min(1, { error: "The port should be between 1 and 65535" })
    .max(65535, { error: "The port should be between 1 and 65535" })
    .default(5432),
  database: z
    .string({ error: "Please enter the database name" })
    .trim()
    .min(1, { error: "Please enter the database name" }),
  user: z
    .string({ error: "Please enter the user name" })
    .trim()
    .min(1, { error: "Please enter the user name" }),
  // Not trimmed: spaces can be part of a password. Empty is allowed for servers that
  // don't ask for one.
  password: z.string({ error: "Please enter the password" }).max(1000).default(""),
  ssl: z.boolean({ error: "SSL should be true or false" }).default(false),
});

export const databaseChoiceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("built-in") }),
  postgresConnectionDetailsSchema.extend({ kind: z.literal("postgres") }),
]);

export type DatabaseChoice = z.infer<typeof databaseChoiceSchema>;

const savedConfigSchema = z.object({ database: databaseChoiceSchema });

/** Where Lintel keeps its local files: the built-in database and the saved choice. */
export interface LintelFolder {
  dataFolder: string;
  configFile: string;
}

export function lintelFolderAt(path: string): LintelFolder {
  return { dataFolder: join(path, "data"), configFile: join(path, "config.json") };
}

/** `.lintel` at the repository root; the same place from `src` (tsx) and from `dist`. */
export const DEFAULT_LINTEL_FOLDER = lintelFolderAt(
  fileURLToPath(new URL("../../../../.lintel", import.meta.url)),
);

export class SavedConfigUnreadableError extends Error {
  constructor(configFile: string, reason: string) {
    super(
      `Lintel can't read its saved settings in ${configFile} (${reason}). ` +
        "Fix the file, or delete it to go back to the built-in database.",
    );
    this.name = "SavedConfigUnreadableError";
  }
}

/** The saved choice, or undefined when setup hasn't saved one yet. */
export function readSavedDatabaseChoice(folder: LintelFolder): DatabaseChoice | undefined {
  let contents: string;
  try {
    contents = readFileSync(folder.configFile, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(contents);
  } catch {
    throw new SavedConfigUnreadableError(folder.configFile, "it isn't valid JSON");
  }

  const parsed = savedConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new SavedConfigUnreadableError(folder.configFile, z.prettifyError(parsed.error));
  }
  return parsed.data.database;
}

/**
 * Saves the choice. The file can hold a database password, so only its owner may read
 * it (Windows ignores the mode; there the user's own folder permissions apply). It is
 * written to a temporary file first and then renamed, so a crash never leaves half a file.
 */
export function saveDatabaseChoice(folder: LintelFolder, choice: DatabaseChoice): void {
  const temporaryFile = `${folder.configFile}.tmp`;
  mkdirSync(join(folder.configFile, ".."), { recursive: true });
  writeFileSync(temporaryFile, `${JSON.stringify({ database: choice }, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryFile, folder.configFile);
  // The mode above only applies to new files; make sure an older file is tightened too.
  chmodSync(folder.configFile, 0o600);
}
