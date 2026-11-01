/**
 * Reads redirects from a CSV, as exported from a spreadsheet or another CMS:
 *
 *   from,to,status
 *   /old-page,/new-page,301
 *   /summer-sale,/offers,302
 *
 * The status column is optional (301 when left out). A first line that doesn't start
 * with an address is taken as headings and skipped. Values may be quoted, and tabs work
 * as well as commas, since that is what copying from a spreadsheet gives.
 */
export interface CsvRedirectLine {
  /** The line number in the file, counting from 1, for problem messages. */
  line: number;
  from: string;
  to: string;
  statusCode: string | undefined;
}

export function parseRedirectCsv(csv: string): CsvRedirectLine[] {
  // Spreadsheets often start the file with an invisible byte-order mark.
  const lines = csv.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const parsed: CsvRedirectLine[] = [];
  lines.forEach((text, index) => {
    if (text.trim() === "") {
      return;
    }
    const [from = "", to = "", statusCode] = splitCsvLine(text).map((value) => value.trim());
    if (index === 0 && looksLikeHeadings(from)) {
      return;
    }
    parsed.push({ line: index + 1, from, to, statusCode: statusCode || undefined });
  });
  return parsed;
}

function looksLikeHeadings(firstValue: string): boolean {
  return !firstValue.startsWith("/") && !/^https?:\/\//i.test(firstValue);
}

/** Splits one line on commas or tabs, honouring "quoted, values" and "" for a quote. */
function splitCsvLine(text: string): string[] {
  const separator = text.includes("\t") && !text.includes(",") ? "\t" : ",";
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === separator) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}
