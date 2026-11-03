import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DataFolderInUseError } from "@lintel/core/data-tools";
import type { ContentModel, LiquidEditorSettings } from "@lintel/core/liquid-editor-commands";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Terminal } from "../terminal.js";
import { makeTemplatesCommand, type ReadContentModel } from "./templates.js";

const model: ContentModel = new Map([
  [
    "contentType:post",
    {
      kind: "contentType",
      handle: "post",
      name: "Blog post",
      collections: [],
      fields: [
        {
          handle: "title",
          label: "Title",
          type: "text",
          required: true,
          helpText: "",
          options: {},
        },
        {
          handle: "cover",
          label: "Cover",
          type: "image",
          required: false,
          helpText: "",
          options: {},
        },
      ],
    },
  ],
]);

describe("lintel templates", () => {
  let root: string;
  let settings: LiquidEditorSettings;
  let terminal: Terminal & { lines: string[] };

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lintel-templates-command-"));
    settings = {
      templatesFolder: join(root, "site"),
      snippetsFolder: join(root, ".vscode"),
      contentModelFolder: join(root, "content-model"),
    };
    const lines: string[] = [];
    terminal = {
      lines,
      say: (line = "") => lines.push(line),
      warn: (line) => lines.push(`warning: ${line}`),
      ask: async () => "",
      workingFolder: root,
    };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function command(readModel: ReadContentModel = async () => model) {
    return makeTemplatesCommand(readModel, () => settings);
  }

  it("shows the usage for a missing or unknown step", async () => {
    await expect(command().run([], terminal)).rejects.toThrow("templates <init|sync>");
    await expect(command().run(["build"], terminal)).rejects.toThrow("templates <init|sync>");
  });

  it("init makes the example folder and every snippets file", async () => {
    expect(await command().run(["init"], terminal)).toBe(0);
    for (const path of [
      "site/templates/pages.liquid",
      "site/layouts/main.liquid",
      "site/partials/card.liquid",
      ".vscode/lintel-liquid.code-snippets",
      ".vscode/lintel-fields.code-snippets",
    ]) {
      expect(existsSync(join(root, path)), path).toBe(true);
      expect(terminal.lines).toContain(`  wrote   ${path}`);
    }
    const fields = await readFile(join(root, ".vscode/lintel-fields.code-snippets"), "utf8");
    expect(fields).toContain("{% image entry.data.cover width: ${1:800} %}$0");
  });

  it("init keeps files that are already there", async () => {
    await command().run(["init"], terminal);
    terminal.lines.length = 0;
    await command().run(["init"], terminal);
    expect(terminal.lines).toContain("  kept    site/layouts/main.liquid (already there)");
    expect(terminal.lines.some((line) => line.startsWith("  wrote"))).toBe(false);
  });

  it("init still works while pnpm dev has the database, and says so", async () => {
    const inUse: ReadContentModel = async () => {
      throw new DataFolderInUseError();
    };
    expect(await command(inUse).run(["init"], terminal)).toBe(0);
    expect(existsSync(join(root, ".vscode/lintel-liquid.code-snippets"))).toBe(true);
    expect(existsSync(join(root, ".vscode/lintel-fields.code-snippets"))).toBe(false);
    expect(terminal.lines.join("\n")).toContain("Restart pnpm dev");
  });

  it("sync writes the field snippets, then says they are up to date", async () => {
    expect(await command().run(["sync"], terminal)).toBe(0);
    expect(terminal.lines.at(-1)).toBe("Snippets for 2 fields are ready.");
    expect(existsSync(join(root, "site"))).toBe(false);
    await command().run(["sync"], terminal);
    expect(terminal.lines.at(-1)).toBe("The snippets were already up to date (2 fields).");
  });

  it("sync explains that pnpm dev already keeps them up to date", async () => {
    const inUse: ReadContentModel = async () => {
      throw new DataFolderInUseError();
    };
    await expect(command(inUse).run(["sync"], terminal)).rejects.toThrow(
      "keeps these snippets up to date itself",
    );
  });
});
