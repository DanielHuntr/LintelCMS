import { isAbsolute, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

/**
 * Talking to the person at the terminal: plain sentences, small aligned tables, and
 * questions. Everything goes through `Terminal` so tests can capture what was said.
 */
export interface Terminal {
  say(line?: string): void;
  warn(line: string): void;
  ask(question: string): Promise<string>;
  /** The folder the person ran the command from, for their relative paths. */
  workingFolder: string;
}

export const processTerminal: Terminal = {
  say: (line = "") => process.stdout.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
  async ask(question) {
    const reader = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await reader.question(question);
    } finally {
      reader.close();
    }
  },
  // `pnpm lintel` runs in packages/cli; INIT_CWD is where the person actually was.
  workingFolder: process.env.INIT_CWD ?? process.cwd(),
};

/** A path typed by the person, made absolute from where they ran the command. */
export function resolvePath(terminal: Terminal, path: string): string {
  return isAbsolute(path) ? path : resolve(terminal.workingFolder, path);
}

/** Rows of cells printed in columns, with two spaces between. */
export function formatTable(rows: ReadonlyArray<readonly string[]>): string[] {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }
  return rows.map((row) =>
    row
      .map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0)))
      .join("  ")
      .trimEnd(),
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function plural(count: number, one: string, other = `${one}s`): string {
  return `${count.toLocaleString("en")} ${count === 1 ? one : other}`;
}

/** A command that can't go on: the message is for the person, not a stack trace. */
export class CommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommandError";
  }
}
