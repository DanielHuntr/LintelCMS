import { ZipFile } from "yazl";
import { csvCell } from "../forms/submissions-csv.js";

/** One kind of data in an export: its name and its rows. */
export interface ExportedKind {
  kindId: string;
  name: string;
  rows: Record<string, unknown>[];
}

/**
 * One person's data as a .zip they can keep or take elsewhere: `personal-data.json` with
 * everything, and a CSV for each kind of data so it opens in a spreadsheet. Nested values
 * (an address, a list of answers) are written into their cell as JSON.
 */
export async function buildPersonalDataArchive(
  kinds: readonly ExportedKind[],
  exportedAt: Date,
): Promise<Buffer> {
  const zip = new ZipFile();
  const everything = {
    exportedAt: exportedAt.toISOString(),
    data: Object.fromEntries(kinds.map((kind) => [kind.name, kind.rows])),
  };
  zip.addBuffer(Buffer.from(JSON.stringify(everything, null, 2)), "personal-data.json");
  for (const kind of kinds) {
    if (kind.rows.length === 0) continue;
    zip.addBuffer(Buffer.from(rowsAsCsv(kind.rows)), `${kind.kindId}.csv`);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export function rowsAsCsv(rows: readonly Record<string, unknown>[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [columns, ...rows.map((row) => columns.map((column) => cellText(row[column])))];
  // The byte order mark makes Excel read the file as UTF-8, so names with accents survive.
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
