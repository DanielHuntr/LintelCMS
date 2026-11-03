import { z } from "zod";

/**
 * What the server and the supervisor say to each other over Node's IPC channel (the
 * supervisor starts the server with `fork`). The server only asks; the supervisor decides.
 */
const switchRequestSchema = z.object({
  type: z.literal("lintel:switch-version"),
  kind: z.enum(["update", "rollback"]),
  /** An unpacked folder under versions/. */
  version: z.string().min(1),
  /** The backup made just before; an update puts it back if it fails after migrating. */
  backupFile: z.string().nullable(),
  /** A roll back that also puts the database back as it was before updating away. */
  restoreBackupFirst: z.boolean(),
  /**
   * For a roll back: the copy of the built-in database made when Lintel updated away from
   * that version, put back instead of the backup. Optional, because the supervisor may be
   * older or newer than the server asking.
   */
  databaseCopy: z.string().nullable().optional(),
});
export type SwitchRequest = Omit<z.infer<typeof switchRequestSchema>, "type">;

export function switchRequestMessage(request: SwitchRequest) {
  return { type: "lintel:switch-version" as const, ...request };
}

export function readSupervisorRequest(message: unknown): SwitchRequest | null {
  const parsed = switchRequestSchema.safeParse(message);
  if (!parsed.success) {
    return null;
  }
  return {
    kind: parsed.data.kind,
    version: parsed.data.version,
    backupFile: parsed.data.backupFile,
    restoreBackupFirst: parsed.data.restoreBackupFirst,
    databaseCopy: parsed.data.databaseCopy ?? null,
  };
}
