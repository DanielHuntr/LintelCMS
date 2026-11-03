import { mkdir, mkdtemp, realpath, rename, rm, symlink, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentLink, currentTarget, pointCurrentAt, versionFolder } from "./install-home.js";

describe("pointing current at a version", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "lintel-home-"));
    for (const version of ["1.0.0", "1.1.0", "1.2.0"]) {
      await mkdir(versionFolder(home, version), { recursive: true });
    }
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  const pointsAt = async () => (await realpath(currentLink(home))).split(/[\\/]/).pop();

  // LINTEL-FUNC-016: on Windows the second switch failed with EPERM, because a junction
  // can't be renamed over another. The Windows way is tried on every computer; the Linux
  // way (one rename over the old link) is the one Windows refuses, so it's tried elsewhere.
  for (const platform of ["win32", "linux"] as const) {
    it.skipIf(platform === "linux" && process.platform === "win32")(
      `switches again and again (${platform} way)`,
      async () => {
        await pointCurrentAt(home, versionFolder(home, "1.0.0"), platform);
        expect(await pointsAt()).toBe("1.0.0");
        await pointCurrentAt(home, versionFolder(home, "1.1.0"), platform);
        expect(await pointsAt()).toBe("1.1.0");
        await pointCurrentAt(home, versionFolder(home, "1.2.0"), platform);
        expect(await pointsAt()).toBe("1.2.0");
        await pointCurrentAt(home, versionFolder(home, "1.0.0"), platform);
        expect(await pointsAt()).toBe("1.0.0");
        expect(existsSync(`${currentLink(home)}.next`)).toBe(false);
        // The folders themselves are never touched.
        expect(existsSync(join(versionFolder(home, "1.1.0")))).toBe(true);
      },
    );
  }

  it("finishes a switch cut off between removing the old link and placing the new one", async () => {
    await pointCurrentAt(home, versionFolder(home, "1.0.0"), "win32");
    // Stopped part-way: the old link is gone, the new one is still current.next.
    await symlink(versionFolder(home, "1.1.0"), `${currentLink(home)}.next`, "junction");
    await unlink(currentLink(home));

    expect(await currentTarget(home, versionFolder(home, "1.0.0"))).toBe(
      await realpath(versionFolder(home, "1.1.0")),
    );
    expect(await pointsAt()).toBe("1.1.0");
  });

  it("leaves a stray current.next alone while current is there", async () => {
    await pointCurrentAt(home, versionFolder(home, "1.0.0"));
    await symlink(versionFolder(home, "1.2.0"), join(home, "spare"), "junction");
    await rename(join(home, "spare"), `${currentLink(home)}.next`);
    expect(await currentTarget(home, home)).toBe(await realpath(versionFolder(home, "1.0.0")));
    // And the next switch replaces it.
    await pointCurrentAt(home, versionFolder(home, "1.1.0"));
    expect(await pointsAt()).toBe("1.1.0");
  });
});
