import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { versionsFolder } from "../install-home.js";

/**
 * versions/switch-journal.json: a switch under way, and how far it got. The supervisor
 * writes it before each step and removes it when the switch has finished either way. If
 * it finds one when it starts, it stopped part-way (a crash, a power cut, the server
 * being restarted), and it finishes or reverses the switch before starting Lintel:
 *
 *   started    nothing changed yet: the old version starts again
 *   copied     the database copy is made: the same
 *   migrating  the new version may have changed the database: put the copy back first
 *   switched   `current` may point at the new version: put the copy back, point it back
 *   healthy    the new version answered: keep it, and record the update as done
 *
 * A roll back that stopped part-way is done again from the start instead, because its
 * steps (put the copy back, point `current` at the older version) can be repeated.
 */
export const switchPhases = ["started", "copied", "migrating", "switched", "healthy"] as const;
export type SwitchPhase = (typeof switchPhases)[number];

export const switchJournalSchema = z.object({
  kind: z.enum(["update", "rollback"]),
  fromVersion: z.string(),
  fromFolder: z.string(),
  toVersion: z.string(),
  toFolder: z.string(),
  backupFile: z.string().nullable(),
  restoreBackupFirst: z.boolean(),
  databaseCopy: z.string().nullable(),
  phase: z.enum(switchPhases),
  startedAt: z.string(),
});
export type SwitchJournal = z.infer<typeof switchJournalSchema>;

const journalFile = (home: string) => join(versionsFolder(home), "switch-journal.json");

export async function writeSwitchJournal(home: string, journal: SwitchJournal): Promise<void> {
  await mkdir(versionsFolder(home), { recursive: true });
  const file = journalFile(home);
  await writeFile(`${file}.next`, JSON.stringify(journal, null, 2));
  await rename(`${file}.next`, file);
}

/** The switch that was under way, or null. An unreadable journal counts as none. */
export async function readSwitchJournal(home: string): Promise<SwitchJournal | null> {
  try {
    const parsed = switchJournalSchema.safeParse(
      JSON.parse(await readFile(journalFile(home), "utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearSwitchJournal(home: string): Promise<void> {
  await rm(journalFile(home), { force: true });
}

/** Whether the database may have been changed by the new version by this phase. */
export function databaseMayHaveChanged(phase: SwitchPhase): boolean {
  return phase === "migrating" || phase === "switched" || phase === "healthy";
}
