import { describe, expect, it } from "vitest";
import { describeSince, SINCE_PATTERN } from "./version.js";

describe("a page's since", () => {
  it("is a release or a release candidate", () => {
    for (const since of ["0.1", "0.6", "1.0", "12.3", "1.0.0-rc", "2.1.0-rc"]) {
      expect(since).toMatch(SINCE_PATTERN);
    }
    for (const since of ["1", "v1.0", "1.0.0", "1.0.0-rc.1", "1.0-rc", "1.0.0-beta", ""]) {
      expect(since).not.toMatch(SINCE_PATTERN);
    }
  });

  it("reads naturally beside the title", () => {
    expect(describeSince("0.6", "0.1")).toBe("Since 0.6");
    expect(describeSince("0.1", "0.1")).toBe("New in 0.1");
    expect(describeSince("1.0.0-rc", "0.1")).toBe("Since the 1.0 release candidate");
    expect(describeSince("1.0.0-rc", "1.0.0-rc")).toBe("New in the 1.0 release candidate");
  });
});
