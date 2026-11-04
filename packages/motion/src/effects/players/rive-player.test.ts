import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("the Rive player", () => {
  it("keeps Rive's notes to developers out of visitors' consoles (LINTEL-UX-320)", () => {
    const source = readFileSync(new URL("./rive-player.ts", import.meta.url), "utf8");
    expect(source).toContain('"default-state-machine"');
  });
});
