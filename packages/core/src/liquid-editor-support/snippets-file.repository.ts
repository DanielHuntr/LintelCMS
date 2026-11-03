import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { type EditorSnippets, LINTEL_SNIPPET_NAME_START } from "./tag-snippets.js";

/**
 * Reading and writing a VS Code `.code-snippets` file, the one place snippets touch the
 * disk. Lintel owns the entries named "Lintel: ...": they are replaced each time, and ones
 * it no longer makes are removed. Every other entry is the developer's and is kept exactly,
 * so snippets of their own can live in the same file.
 */

export const TAG_SNIPPETS_FILE = "lintel-liquid.code-snippets";
export const FIELD_SNIPPETS_FILE = "lintel-fields.code-snippets";

/** A snippets file that isn't JSON (with comments) can't be merged, so it's left alone. */
export class SnippetsFileUnreadableError extends Error {
  constructor(readonly path: string) {
    super(
      `${path} isn't a snippets file Lintel can read, so it was left as it is. ` +
        "Fix it or delete it, then run the command again.",
    );
    this.name = "SnippetsFileUnreadableError";
  }
}

const HEADER = [
  "// Snippets for Lintel's Liquid templates, written by `lintel templates sync`.",
  '// Entries named "Lintel: ..." are rewritten each time. Add your own under any other',
  "// name, here or in a .code-snippets file of your own, and they are kept.",
].join("\n");

/**
 * Puts Lintel's snippets in the file, keeping the developer's own entries. Returns false
 * when the file already said exactly this, so nothing was written.
 */
export async function writeSnippetsFile(path: string, ours: EditorSnippets): Promise<boolean> {
  const existingText = await readTextIfThere(path);
  const existing = existingText === undefined ? {} : parseSnippetsText(existingText, path);
  const theirs = Object.entries(existing).filter(
    ([name]) => !name.startsWith(LINTEL_SNIPPET_NAME_START),
  );
  const merged = { ...ours, ...Object.fromEntries(theirs) };
  const text = `${HEADER}\n${JSON.stringify(merged, null, 2)}\n`;
  if (text === existingText) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
  return true;
}

async function readTextIfThere(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

/** A snippets file's entries. VS Code allows comments and trailing commas in them. */
export function parseSnippetsText(text: string, path: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutTrailingCommas(withoutComments(text)));
  } catch {
    throw new SnippetsFileUnreadableError(path);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SnippetsFileUnreadableError(path);
  }
  return parsed as Record<string, unknown>;
}

/** Drops `//` and `/* *\/` comments, leaving strings (which may contain them) alone. */
function withoutComments(text: string): string {
  let result = "";
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"') {
      const end = endOfString(text, index);
      result += text.slice(index, end);
      index = end;
    } else if (character === "/" && next === "/") {
      const end = text.indexOf("\n", index);
      index = end === -1 ? text.length : end;
    } else if (character === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      index = end === -1 ? text.length : end + 2;
    } else {
      result += character;
      index += 1;
    }
  }
  return result;
}

/** The index just after the string that starts at `start`, minding escaped quotes. */
function endOfString(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length && text[index] !== '"') {
    index += text[index] === "\\" ? 2 : 1;
  }
  return index + 1;
}

function withoutTrailingCommas(text: string): string {
  let result = "";
  let index = 0;
  while (index < text.length) {
    if (text[index] === '"') {
      const end = endOfString(text, index);
      result += text.slice(index, end);
      index = end;
      continue;
    }
    const character = text[index] ?? "";
    if (character === ",") {
      const rest = text.slice(index + 1).trimStart();
      if (rest.startsWith("}") || rest.startsWith("]")) {
        index += 1;
        continue;
      }
    }
    result += character;
    index += 1;
  }
  return result;
}
