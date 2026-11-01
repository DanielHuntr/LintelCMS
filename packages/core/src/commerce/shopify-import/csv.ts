/**
 * Reads CSV as spreadsheets write it (RFC 4180): fields in double quotes may hold commas,
 * line breaks and doubled quotes (""), lines end in \n or \r\n, and a leading byte-order
 * mark is ignored. Shopify's exports are like this: product descriptions often span lines.
 */
export interface CsvTable {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvFormatError";
  }
}

export function parseCsv(text: string): CsvTable {
  const records = readRecords(text.replace(/^\uFEFF/, ""));
  const [header, ...body] = records;
  if (!header || header.every((cell) => cell.trim() === "")) {
    throw new CsvFormatError("The file is empty. Export it from Shopify again.");
  }
  const columns = header.map((cell) => cell.trim());
  const rows = body
    .filter((record) => record.some((cell) => cell.trim() !== ""))
    .map((record) =>
      Object.fromEntries(columns.map((column, index) => [column, record[index] ?? ""])),
    );
  return { columns, rows };
}

function readRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"' && field === "") {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) {
    throw new CsvFormatError(
      "The file ends in the middle of a quoted value, so it may have been cut short. Export it from Shopify again.",
    );
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}
