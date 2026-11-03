import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  asContentModelCommands,
  type ContentModelCommands,
  contentModelSettings,
  loadContentModelCommands,
} from "../content-model/content-model-commands.js";
import type { Terminal } from "../terminal.js";
import { makeModelCommand } from "./model.js";

function recordingTerminal(): Terminal & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    say: (line = "") => lines.push(line),
    warn: (line) => lines.push(`warning: ${line}`),
    ask: async () => "",
    workingFolder: "/home/ana/site",
  };
}

/** Commands that need no database: `check` is the only one that runs without opening it. */
function fakeCommands(problems: string[]): ContentModelCommands {
  const unused = async () => {
    throw new Error("not used in this test");
  };
  return {
    pullModel: unused,
    diffModel: unused,
    pushModel: unused,
    writeModelTypes: unused,
    checkModel: async () => ({ problems, unitCount: 4 }),
    describeChanges: () => "",
  };
}

describe("lintel model", () => {
  it("explains when this copy of Lintel doesn't have the content model commands", async () => {
    const command = makeModelCommand(async () => undefined);
    await expect(command.run(["diff"], recordingTerminal())).rejects.toThrow(
      "doesn't have the content model commands yet",
    );
  });

  it("shows the usage for a missing or unknown step", async () => {
    const command = makeModelCommand(async () => fakeCommands([]));
    await expect(command.run([], recordingTerminal())).rejects.toThrow(
      "pull|push|diff|types|check",
    );
    await expect(command.run(["sync"], recordingTerminal())).rejects.toThrow(
      "pull|push|diff|types|check",
    );
  });

  it("checks the model files and fails with each problem", async () => {
    const terminal = recordingTerminal();
    expect(await makeModelCommand(async () => fakeCommands([])).run(["check"], terminal)).toBe(0);
    expect(terminal.lines[0]).toContain("is valid (4 files)");

    const failing = makeModelCommand(async () => fakeCommands(["posts.ts has no title field"]));
    await expect(failing.run(["check"], recordingTerminal())).rejects.toThrow(
      "  - posts.ts has no title field",
    );
  });

  it("only accepts a module that has every command", () => {
    expect(asContentModelCommands(fakeCommands([]))).toBeDefined();
    expect(asContentModelCommands({ pullModel: () => undefined })).toBeUndefined();
    expect(asContentModelCommands(undefined)).toBeUndefined();
  });

  it("loads without failing whether or not core has the commands", async () => {
    const loaded = await loadContentModelCommands();
    expect(loaded === undefined || typeof loaded.diffModel === "function").toBe(true);
  });

  it("reads the same settings and defaults as the server", () => {
    const defaults = contentModelSettings({});
    expect(defaults.folder.endsWith(`${path.sep}content-model`)).toBe(true);
    expect(defaults.format).toBe("typescript");
    expect(defaults.typesFile.endsWith(path.join(path.sep, "generated", "lintel-content.ts"))).toBe(
      true,
    );
    expect(
      contentModelSettings({ CONTENT_MODEL_FORMAT: "yaml", CONTENT_MODEL_FOLDER: "/srv/model" }),
    ).toMatchObject({
      folder: "/srv/model",
      format: "yaml",
    });
  });
});
