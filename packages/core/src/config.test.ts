import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("starts with no settings at all, using the built-in database", () => {
    const config = loadConfig({});

    expect(config.DATABASE_URL).toBeUndefined();
    expect(config.API_PORT).toBe(4000);
    expect(config.ADMIN_ORIGIN).toBe("http://localhost:5173");
    expect(config.NODE_ENV).toBe("production");
  });

  it("uses the address Railway, Render or Fly.io gave the app until PUBLIC_URL is set", () => {
    expect(loadConfig({ RENDER_EXTERNAL_URL: "https://lintel-ab12.onrender.com" }).PUBLIC_URL).toBe(
      "https://lintel-ab12.onrender.com",
    );
    expect(loadConfig({ RAILWAY_PUBLIC_DOMAIN: "lintel.up.railway.app" }).PUBLIC_URL).toBe(
      "https://lintel.up.railway.app",
    );
    expect(loadConfig({ FLY_APP_NAME: "my-lintel" }).PUBLIC_URL).toBe("https://my-lintel.fly.dev");
    expect(
      loadConfig({ FLY_APP_NAME: "my-lintel", PUBLIC_URL: "https://cms.example.com" }).PUBLIC_URL,
    ).toBe("https://cms.example.com");
    expect(loadConfig({}).PUBLIC_URL).toBeUndefined();
  });

  it("treats an empty DATABASE_URL line as not set", () => {
    expect(loadConfig({ DATABASE_URL: "" }).DATABASE_URL).toBeUndefined();
  });

  it("accepts a Postgres URL with an encoded password", () => {
    const databaseUrl = "postgres://lintel:p%23ss%40word%2F1@localhost:5432/lintel";

    expect(loadConfig({ DATABASE_URL: databaseUrl }).DATABASE_URL).toBe(databaseUrl);
  });

  it("explains how to encode special characters when the URL can't be read", () => {
    // What a password of "pa#ss/word" looks like when it isn't encoded.
    expect(() =>
      loadConfig({ DATABASE_URL: "postgres://lintel:pa#ss/word@localhost/lintel" }),
    ).toThrow(/DATABASE_URL.*%23, %40 or %2F/s);
    expect(() => loadConfig({ DATABASE_URL: "postgres://lintel:pa/ss@localhost/lintel" })).toThrow(
      /DATABASE_URL/,
    );
    expect(() => loadConfig({ DATABASE_URL: "oracle://localhost/lintel" })).toThrow(/DATABASE_URL/);
  });

  it("reads which proxies to trust", () => {
    // By default, proxies on this computer and private networks, never the open internet.
    expect(loadConfig({}).TRUST_PROXY).toEqual(["loopback", "linklocal", "uniquelocal"]);
    expect(loadConfig({ TRUST_PROXY: "false" }).TRUST_PROXY).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "true" }).TRUST_PROXY).toBe(true);
    expect(loadConfig({ TRUST_PROXY: "1" }).TRUST_PROXY).toBe(1);
    expect(loadConfig({ TRUST_PROXY: "10.0.0.1,10.0.0.2" }).TRUST_PROXY).toEqual([
      "10.0.0.1",
      "10.0.0.2",
    ]);
  });
});
