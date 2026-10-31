import { describe, expect, it } from "vitest";
import { targetFromUrl } from "./database-errors.js";
import { buildPostgresUrl } from "./postgres-database.js";

describe("buildPostgresUrl", () => {
  it("encodes the user, password and database, so special characters can't break the URL", () => {
    const details = {
      host: "db.example.com",
      port: 5432,
      database: "my site",
      user: "ana@work",
      password: "p#ss@w/rd 100%",
      ssl: true,
    };

    const url = buildPostgresUrl(details);

    expect(url).toBe(
      "postgres://ana%40work:p%23ss%40w%2Frd%20100%25@db.example.com:5432/my%20site?sslmode=require",
    );
    expect(decodeURIComponent(new URL(url).password)).toBe(details.password);
    expect(targetFromUrl(url)).toMatchObject({ user: "ana@work", database: "my site" });
  });

  it("leaves the password out when there isn't one, and brackets IPv6 addresses", () => {
    expect(
      buildPostgresUrl({
        host: "::1",
        port: 5432,
        database: "lintel",
        user: "lintel",
        password: "",
        ssl: false,
      }),
    ).toBe("postgres://lintel@[::1]:5432/lintel");
  });
});
