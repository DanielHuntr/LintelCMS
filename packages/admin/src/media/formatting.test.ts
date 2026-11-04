import { describe, expect, it } from "vitest";
import { formatFileSize } from "./formatting.js";

describe("file sizes", () => {
  it("says bytes in full, and keeps the short units people know (LINTEL-UX-308)", () => {
    expect(formatFileSize(646)).toBe("646 bytes");
    expect(formatFileSize(1)).toBe("1 byte");
    expect(formatFileSize(320_000)).toBe("320 kB");
    expect(formatFileSize(2_400_000)).toBe("2.4 MB");
  });
});
