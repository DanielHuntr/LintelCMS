import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRemoteManifest } from "../upload-plan.js";
import { openFolderRemote } from "./folder-remote.js";
import { remotePath } from "./remote-folder.js";

/**
 * Paths can come from the list of files kept on the host, which isn't Lintel's to trust, so
 * nothing may reach further than the folder beside the website.
 */
describe("where a publish may reach", () => {
  it("allows the website's folder and the private folder beside it", () => {
    expect(remotePath("public_html", "index.html")).toBe("public_html/index.html");
    expect(remotePath("public_html", "../lintel-private/config.php")).toBe(
      "lintel-private/config.php",
    );
    expect(remotePath("", "../lintel-private/config.php")).toBe("../lintel-private/config.php");
    expect(remotePath("/var/www/html", "../lintel-private/a")).toBe("/var/www/lintel-private/a");
  });

  it("refuses anything further out, with a relative or an absolute folder", () => {
    expect(() => remotePath("public_html", "../../etc/passwd")).toThrow(/outside/);
    expect(() => remotePath("", "../../etc/passwd")).toThrow(/outside/);
    expect(() => remotePath("/var/www/html", "../../../etc/passwd")).toThrow(/outside/);
  });

  it("ignores files in the host's list that aren't plain paths in the website", () => {
    const manifest = readRemoteManifest(
      Buffer.from(
        JSON.stringify({
          version: 1,
          files: {
            "about/index.html": "a",
            "../other-site/index.html": "b",
            "/etc/passwd": "c",
            "..\\other-site\\index.html": "d",
            "C:/Windows/win.ini": "e",
          },
          privateFiles: { "../lintel-private/config.php": "f", "../../secrets.php": "g" },
        }),
      ),
    );
    expect(manifest.files).toEqual({ "about/index.html": "a" });
    expect(manifest.privateFiles).toEqual({ "../lintel-private/config.php": "f" });
  });
});

describe("a folder on this server", () => {
  let parent: string;

  beforeEach(async () => {
    parent = await mkdtemp(join(tmpdir(), "lintel-remote-paths-"));
    await mkdir(join(parent, "sites", "mine"), { recursive: true });
    await mkdir(join(parent, "sites-backup"), { recursive: true });
    await writeFile(join(parent, "sites-backup", "keep.txt"), "keep");
  });

  afterEach(() => rm(parent, { recursive: true, force: true }));

  it("can't reach a folder whose name only starts like the one beside it", async () => {
    const remote = openFolderRemote(join(parent, "sites", "mine"));
    await expect(remote.deleteFile("../../sites-backup/keep.txt")).rejects.toThrow(/outside/);
    expect(await readFile(join(parent, "sites-backup", "keep.txt"), "utf8")).toBe("keep");
  });

  it("still writes beside the website, for the private folder", async () => {
    const remote = openFolderRemote(join(parent, "sites", "mine"));
    await remote.writeFile("../lintel-private/config.php", Buffer.from("x"));
    expect(await readFile(join(parent, "sites", "lintel-private", "config.php"), "utf8")).toBe("x");
  });
});
