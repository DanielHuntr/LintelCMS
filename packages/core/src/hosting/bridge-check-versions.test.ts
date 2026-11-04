import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BRIDGE_MINIMUM_PHP_VERSION } from "../bridge/bridge-files.js";

/** The checker mustn't send someone to their host for a PHP the companion doesn't need. */
describe("lintel-check.php", () => {
  it("asks for the same PHP as lintel-bridge.php", () => {
    const check = readFileSync(new URL("./files/lintel-check.php", import.meta.url), "utf8");
    const bridge = readFileSync(new URL("../bridge/lintel-bridge.php", import.meta.url), "utf8");
    const wanted = /\$bridgeMinimumPhp = '([\d.]+)'/.exec(check)?.[1];
    const needed = /LINTEL_BRIDGE_MINIMUM_PHP = '([\d.]+)'/.exec(bridge)?.[1];
    expect(wanted).toBe(needed);
    expect(wanted).toBe(`${BRIDGE_MINIMUM_PHP_VERSION}.0`);
  });
});
