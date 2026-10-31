import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("uses sensible defaults when only the database URL is set", () => {
    const config = loadConfig({ DATABASE_URL: "postgres://lintel:lintel@localhost:5432/lintel" });

    expect(config.API_PORT).toBe(4000);
    expect(config.ADMIN_ORIGIN).toBe("http://localhost:5173");
    expect(config.NODE_ENV).toBe("production");
  });

  it("names the setting that is wrong", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
