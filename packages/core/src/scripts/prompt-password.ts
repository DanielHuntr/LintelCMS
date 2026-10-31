import { createInterface } from "node:readline/promises";

const ENTER = ["\r", "\n", "\u0004"]; // Enter, or Ctrl+D to finish
const CONTROL_C = "\u0003";
const BACKSPACE = ["\u007f", "\b"];

/**
 * Asks for a password in the terminal without showing what is typed.
 * When input is piped in (not a terminal), it simply reads one line.
 */
export async function promptPassword(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return readOneLine(question);
  }

  process.stdout.write(question);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  try {
    return await readHiddenInput();
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
  }
}

function readHiddenInput(): Promise<string> {
  return new Promise((resolve, reject) => {
    let typed = "";

    const onData = (keys: string) => {
      for (const key of keys) {
        if (ENTER.includes(key)) {
          process.stdin.off("data", onData);
          resolve(typed);
          return;
        }
        if (key === CONTROL_C) {
          process.stdin.off("data", onData);
          reject(new Error("Cancelled."));
          return;
        }
        typed = BACKSPACE.includes(key) ? typed.slice(0, -1) : typed + key;
      }
    };

    process.stdin.on("data", onData);
  });
}

async function readOneLine(question: string): Promise<string> {
  const lineReader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await lineReader.question(question);
  } finally {
    lineReader.close();
  }
}
