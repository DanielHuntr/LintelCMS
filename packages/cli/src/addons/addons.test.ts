import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type LintelPlugin,
  installedPackageFolder,
  loadSiteAddons,
  readAddonsList,
  writeAddonsList,
} from "@lintel/core/data-tools";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { definePlugin } from "@lintel/core/plugin";
import { runCommandLine } from "../command-line.js";
import { makeAddonsCommand } from "../commands/addons.js";
import type { Terminal } from "../terminal.js";
import { buildAddon } from "./addon-build.js";
import { printAddonCommands, runAddonCommand } from "./addon-commands.js";
import { type NpmRunner, runNpm } from "./addon-install.js";
import { scaffoldAddon } from "./addon-scaffold.js";

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const ADMIN_PACKAGES = join(REPOSITORY_ROOT, "packages", "admin", "node_modules");

function recordingTerminal(workingFolder: string) {
  const said: string[] = [];
  const terminal: Terminal = {
    say: (line = "") => said.push(line),
    warn: (line) => said.push(`! ${line}`),
    ask: async () => "",
    workingFolder,
  };
  return { terminal, said };
}

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "lintel-cli-addons-"));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

describe("lintel addons new and build", () => {
  it("makes an add-on that builds and that Lintel loads", async () => {
    const { terminal, said } = recordingTerminal(folder);
    const addonFolder = await scaffoldAddon({ name: "star-ratings", terminal });

    expect(said[0]).toBe('Made the add-on "star-ratings" in star-ratings. Next:');
    const packageFile = JSON.parse(await readFile(join(addonFolder, "package.json"), "utf8"));
    expect(packageFile["lintel-addon"]).toMatchObject({
      id: "star-ratings",
      server: "dist/server.js",
    });
    for (const file of [
      "src/server/index.ts",
      "src/server/index.test.ts",
      "src/admin/index.tsx",
      "README.md",
      "drizzle.config.ts",
      "drizzle.mysql.config.ts",
      "src/server/mysql-schema.cjs",
    ]) {
      expect(existsSync(join(addonFolder, file))).toBe(true);
    }
    expect(packageFile.files).toContain("migrations-mysql");

    await buildAddon(addonFolder, { watch: false, terminal, nodePaths: [ADMIN_PACKAGES] });
    const adminBundle = await readFile(join(addonFolder, "dist", "admin.js"), "utf8");
    // Lintel's own React is used, not a copy of it.
    expect(adminBundle).toContain("__lintelAddonModules");
    expect(adminBundle).not.toContain("react.production");

    const lintelRoot = join(folder, "site");
    await writeAddonsList(join(lintelRoot, "addons"), {
      packages: [],
      linked: [addonFolder],
      enableOnStart: [],
    });
    const addons = await loadSiteAddons(lintelRoot, []);
    expect(addons.problems).toEqual([]);
    const [loaded] = addons.loaded;
    expect(loaded?.plugin.id).toBe("star-ratings");
    expect(loaded?.plugin.fieldtypes?.map(({ type }) => type)).toEqual(["star-ratings.rating"]);
    expect(loaded?.plugin.blocks?.map(({ handle }) => handle)).toEqual(["star_ratings_callout"]);
    expect(loaded?.plugin.liquid?.tags?.map(({ name }) => name)).toEqual(["star_ratings_stars"]);
  }, 60_000);

  it("has nothing to build for an add-on with no code (LINTEL-UX-287)", async () => {
    const { terminal, said } = recordingTerminal(folder);
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({
        name: "votes",
        "lintel-addon": {
          id: "votes",
          lintel: "*",
          personalData: {
            tables: [{ name: "votes_cast", columns: [{ name: "email", personalData: true }] }],
          },
        },
      }),
    );

    await buildAddon(folder, { watch: false, terminal });

    expect(said).toEqual(["votes has no code, so there's nothing to build."]);
  });

  it("won't make an add-on over files already there, or with an unusable name", async () => {
    const { terminal } = recordingTerminal(folder);
    await expect(scaffoldAddon({ name: "Star Ratings!", terminal })).rejects.toThrow(
      /lowercase letters, numbers and dashes/,
    );
    await mkdir(join(folder, "taken"));
    await writeFile(join(folder, "taken", "notes.txt"), "mine");
    await expect(scaffoldAddon({ name: "taken", terminal })).rejects.toThrow(/already has files/);
  });
});

describe("lintel addons add, remove and list", () => {
  /** A stand-in for npm that "installs" packages from fixture folders. */
  function fakeNpm(packages: Record<string, { version: string; manifest: object }>): NpmRunner {
    return (addonsFolder, [action, specifier]) => {
      // "@acme/lintel-swatches@1" is installed as "@acme/lintel-swatches".
      const name = specifier?.replace(/(?<=.)@[^/]*$/, "");
      const packageFile = join(addonsFolder, "package.json");
      const project = JSON.parse(readFileSync(packageFile, "utf8"));
      if (action === "install" && name && packages[name]) {
        const installed = installedPackageFolder(addonsFolder, name);
        mkdirSync(installed, { recursive: true });
        writeFileSync(
          join(installed, "package.json"),
          JSON.stringify({
            name,
            version: packages[name].version,
            "lintel-addon": packages[name].manifest,
          }),
        );
        project.dependencies[name] = `^${packages[name].version}`;
      } else if (action === "uninstall" && name) {
        delete project.dependencies[name];
        rmSync(installedPackageFolder(addonsFolder, name), { recursive: true, force: true });
      } else {
        return false;
      }
      writeFileSync(packageFile, JSON.stringify(project));
      return true;
    };
  }

  function addonsCommandFor(npm: NpmRunner) {
    return makeAddonsCommand({ npm, folder: () => join(folder, "addons") });
  }

  const packages = {
    "@acme/lintel-swatches": {
      version: "1.2.0",
      manifest: {
        id: "swatches",
        lintel: ">=1.0.0-rc.1",
        tables: [
          {
            name: "swatches_palettes",
            purpose: "Saved colour palettes.",
            columns: [{ name: "made_by", purpose: "Who made it.", personalData: true }],
          },
        ],
        hosts: [{ host: "colours.example", purpose: "Looks up colour names." }],
      },
    },
    "far-future": { version: "9.0.0", manifest: { id: "future", lintel: ">=99.0.0" } },
  };

  it("installs an add-on and switches it on at the next start", async () => {
    const { terminal, said } = recordingTerminal(folder);
    const command = addonsCommandFor(fakeNpm(packages));

    expect(await command.run(["add", "@acme/lintel-swatches@1"], terminal)).toBe(0);

    expect(said).toEqual([
      "Added @acme/lintel-swatches 1.2.0.",
      // What it says it keeps and does, before it runs.
      "What it stores:",
      "  swatches_palettes: Saved colour palettes.",
      "    Personal data: made_by",
      "What it adds to your website:",
      "  No public addresses, as it says.",
      "What runs by itself:",
      "  Nothing, as it says.",
      "Who it talks to:",
      "  colours.example: Looks up colour names.",
      "Where it comes from:",
      "  @acme/lintel-swatches 1.2.0",
      "Build → Add-ons checks this against what it finds once it runs.",
      "Restart Lintel to start using it. It will be switched on.",
    ]);
    expect(await readAddonsList(join(folder, "addons"))).toEqual({
      packages: ["@acme/lintel-swatches"],
      linked: [],
      enableOnStart: ["swatches"],
    });

    said.length = 0;
    await command.run(["list"], terminal);
    expect(said[1]).toMatch(/^@acme\/lintel-swatches\s+1\.2\.0\s+swatches\s+yes$/);

    said.length = 0;
    expect(await command.run(["remove", "swatches"], terminal)).toBe(0);
    expect(said[0]).toBe("Removed @acme/lintel-swatches. Restart Lintel to start without it.");
    expect(await readAddonsList(join(folder, "addons"))).toEqual({
      packages: [],
      linked: [],
      enableOnStart: [],
    });
  });

  it("takes back an add-on that doesn't work with this Lintel", async () => {
    const { terminal } = recordingTerminal(folder);
    const command = addonsCommandFor(fakeNpm(packages));

    await expect(command.run(["add", "far-future"], terminal)).rejects.toThrow(
      /works with Lintel >=99\.0\.0, and this is Lintel .*, so it wasn't added/,
    );
    expect(existsSync(installedPackageFolder(join(folder, "addons"), "far-future"))).toBe(false);
    expect((await readAddonsList(join(folder, "addons"))).packages).toEqual([]);
  });

  it("links a folder being worked on", async () => {
    const work = join(folder, "work", "swatches");
    await mkdir(work, { recursive: true });
    await writeFile(
      join(work, "package.json"),
      JSON.stringify({ name: "swatches", "lintel-addon": { id: "swatches", lintel: "*" } }),
    );
    const { terminal } = recordingTerminal(folder);
    const command = addonsCommandFor(fakeNpm(packages));

    await command.run(["link", "work/swatches"], terminal);
    expect((await readAddonsList(join(folder, "addons"))).linked).toEqual([work]);

    await command.run(["unlink", "swatches"], terminal);
    expect((await readAddonsList(join(folder, "addons"))).linked).toEqual([]);
  });
});

describe("lintel addons add with npm itself", () => {
  const exampleFolder = join(REPOSITORY_ROOT, "packages", "addon-example");

  it("installs the example add-on from a packed .tgz, and Lintel loads it", async () => {
    const { terminal, said } = recordingTerminal(folder);
    // The package as it would be published: built, then packed by npm.
    await buildAddon(exampleFolder, { watch: false, terminal, nodePaths: [ADMIN_PACKAGES] });
    const packed = join(folder, "packed");
    mkdirSync(packed);
    const pack = spawnSync("npm", ["pack", "--pack-destination", packed], {
      cwd: exampleFolder,
      shell: process.platform === "win32",
      encoding: "utf8",
    });
    expect(pack.status, pack.stderr).toBe(0);
    const tarball = readdirSync(packed).find((name) => name.endsWith(".tgz"));
    expect(tarball).toBeDefined();

    const command = makeAddonsCommand({ npm: runNpm, folder: () => join(folder, "addons") });
    said.length = 0;
    expect(await command.run(["add", join(packed, tarball ?? "")], terminal)).toBe(0);
    expect(said[0]).toBe("Added @lintel/addon-example 0.1.0.");
    expect(said).toContain(
      "  check-hours: Once a day, notes in the log if no opening hours are set.",
    );

    const installed = installedPackageFolder(join(folder, "addons"), "@lintel/addon-example");
    expect(existsSync(join(installed, "dist", "server.js"))).toBe(true);
    const lock = JSON.parse(readFileSync(join(folder, "addons", "package-lock.json"), "utf8"));
    expect(lock.packages["node_modules/@lintel/addon-example"].integrity).toMatch(/^sha512-/);
    expect(await readAddonsList(join(folder, "addons"))).toEqual({
      packages: ["@lintel/addon-example"],
      linked: [],
      enableOnStart: ["example"],
    });

    const addons = await loadSiteAddons(folder, []);
    expect(addons.problems).toEqual([]);
    expect(addons.loaded.map(({ plugin }) => plugin.id)).toEqual(["example"]);

    expect(await command.run(["remove", "example"], terminal)).toBe(0);
    expect(existsSync(installed)).toBe(false);
  }, 180_000);
});

describe("add-ons' own commands", () => {
  const plugins: LintelPlugin[] = [
    definePlugin({
      id: "swatches",
      name: "Swatches",
      description: "Colours.",
      commands: [
        { name: "export", description: "Writes the palette to a file.", run: async () => 0 },
      ],
    }),
  ];

  it("are listed in lintel help", async () => {
    const { terminal, said } = recordingTerminal(folder);
    await printAddonCommands(terminal, async () => plugins);
    expect(said.slice(1)).toEqual([
      "Add-on commands:",
      "",
      "  swatches:export  Writes the palette to a file.",
    ]);
  });

  it("say so when there's no such command", async () => {
    const { terminal } = recordingTerminal(folder);
    await expect(
      runAddonCommand("swatches:import", [], terminal, async () => plugins),
    ).rejects.toThrow('There is no "swatches:import" command.');
    const help = recordingTerminal(folder);
    expect(
      await runAddonCommand("swatches:export", ["--help"], help.terminal, async () => plugins),
    ).toBe(0);
    expect(help.said).toEqual(["Writes the palette to a file."]);
  });

  it("are reached from the command line by their full name", async () => {
    const { terminal, said } = recordingTerminal(folder);
    // No add-ons are installed in this test's Lintel folder.
    process.env.LINTEL_FOLDER = folder;
    try {
      expect(await runCommandLine(["nothing:here"], terminal)).toBe(1);
    } finally {
      delete process.env.LINTEL_FOLDER;
    }
    expect(said[0]).toMatch(/There is no "nothing:here" command/);
  });
});
