import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { productionAddresses, trustProxyOption } from "./production.config.js";

describe("production settings", () => {
  it("work out every address from PUBLIC_URL", () => {
    const config = loadConfig({ PUBLIC_URL: "https://example.com/", PORT: "8080" });

    expect(productionAddresses(config)).toEqual({
      port: 8080,
      publicUrl: "https://example.com",
      publicApiUrl: "https://example.com/api",
      adminOrigin: "https://example.com",
      adminUrl: "https://example.com/admin",
    });
  });

  it("fall back to API_PORT and localhost when nothing is set", () => {
    const addresses = productionAddresses(loadConfig({}));

    expect(addresses.port).toBe(4000);
    expect(addresses.publicApiUrl).toBe("http://localhost:4000/api");
  });

  it("refuse a plain-HTTP public address, which would stop anyone signing in", () => {
    expect(() => loadConfig({ PUBLIC_URL: "http://example.com" })).toThrow(
      /PUBLIC_URL: Starts with http:\/\/.*ALLOW_INSECURE_HTTP/s,
    );
    expect(
      loadConfig({ PUBLIC_URL: "http://example.com", ALLOW_INSECURE_HTTP: "yes" })
        .ALLOW_INSECURE_HTTP,
    ).toBe(true);
    // Browsers treat localhost as secure, so a local trial run is fine.
    expect(() => loadConfig({ PUBLIC_URL: "http://localhost:4000" })).not.toThrow();
    expect(() =>
      loadConfig({ NODE_ENV: "development", PUBLIC_URL: "http://example.com" }),
    ).not.toThrow();
  });

  it("explain a public address with a path, or that isn't an address", () => {
    expect(() => loadConfig({ PUBLIC_URL: "https://example.com/cms" })).toThrow(/with no path/);
    expect(() => loadConfig({ PUBLIC_URL: "example.com" })).toThrow(/starting with https:\/\//);
  });

  it("tidy the admin path and keep it away from the API", () => {
    expect(loadConfig({ ADMIN_PATH: "/cms/" }).ADMIN_PATH).toBe("/cms");
    expect(() => loadConfig({ ADMIN_PATH: "/api" })).toThrow(/ADMIN_PATH: Can't be \/api/);
    expect(() => loadConfig({ ADMIN_PATH: "admin" })).toThrow(/ADMIN_PATH/);
  });

  it("trust proxies on private networks by default, and accept other choices", () => {
    expect(loadConfig({}).TRUST_PROXY).toEqual(["loopback", "linklocal", "uniquelocal"]);
    expect(loadConfig({ TRUST_PROXY: "false" }).TRUST_PROXY).toBe(false);
    expect(loadConfig({ TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);

    const twoHops = trustProxyOption(2);
    expect(typeof twoHops === "function" && [twoHops("1.1.1.1", 0), twoHops("1.1.1.1", 2)]).toEqual(
      [true, false],
    );
  });

  it("list every wrong setting at once, by name", () => {
    expect(() =>
      loadConfig({ PORT: "eighty", LOG_LEVEL: "loud", SHUTDOWN_TIMEOUT_SECONDS: "0" }),
    ).toThrow(
      /PORT: Should be a port number.*LOG_LEVEL: Should be one of.*SHUTDOWN_TIMEOUT_SECONDS: Should be at least 1/s,
    );
  });
});

describe("storage settings", () => {
  it("keep files on disk unless told otherwise", () => {
    expect(loadConfig({}).STORAGE_DRIVER).toBe("local");
  });

  it("need a bucket for S3, and both keys or neither", () => {
    expect(() => loadConfig({ STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET: STORAGE_DRIVER is s3/);
    expect(() =>
      loadConfig({ STORAGE_DRIVER: "s3", S3_BUCKET: "media", S3_ACCESS_KEY_ID: "key" }),
    ).toThrow(/S3_SECRET_ACCESS_KEY: .*go together/);
    const r2 = loadConfig({
      STORAGE_DRIVER: "s3",
      S3_BUCKET: "media",
      S3_REGION: "auto",
      S3_ENDPOINT: "https://account.r2.cloudflarestorage.com",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_SIGNED_URLS: "true",
    });
    expect(r2.S3_SIGNED_URLS).toBe(true);
    expect(r2.S3_SIGNED_URL_SECONDS).toBe(3600);
  });
});

describe("email settings", () => {
  it("use the outbox until a driver is chosen", () => {
    expect(loadConfig({}).EMAIL_DRIVER).toBe("outbox");
  });

  it("ask for what each driver needs, and a real sender", () => {
    expect(() => loadConfig({ EMAIL_DRIVER: "smtp", EMAIL_FROM: "hello@example.com" })).toThrow(
      /SMTP_HOST: EMAIL_DRIVER is smtp/,
    );
    expect(() => loadConfig({ EMAIL_DRIVER: "resend", RESEND_API_KEY: "re_1" })).toThrow(
      /EMAIL_FROM: Set the address emails come from/,
    );
    expect(() => loadConfig({ EMAIL_FROM: "not an address" })).toThrow(
      /EMAIL_FROM: Should be an email address/,
    );
    expect(
      loadConfig({
        EMAIL_DRIVER: "postmark",
        POSTMARK_SERVER_TOKEN: "t",
        EMAIL_FROM: "Site <a@example.com>",
      }).EMAIL_DRIVER,
    ).toBe("postmark");
  });
});
