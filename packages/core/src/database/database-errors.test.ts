import { describe, expect, it } from "vitest";
import { describeDatabaseError, targetFromUrl } from "./database-errors.js";
import { checkPostgresConnection } from "./postgres-database.js";

const target = { host: "localhost", port: 5432, database: "lintel", user: "lintel" };

/** Shaped like the errors postgres-js gives: a message, a code, and a severity from Postgres. */
function postgresError(code: string, message: string): Error {
  return Object.assign(new Error(message), { code, severity: "FATAL" });
}

function networkError(code: string): Error {
  return Object.assign(new Error(`connect ${code}`), { code });
}

describe("describeDatabaseError", () => {
  it("asks whether Postgres is running when nothing answers", () => {
    expect(describeDatabaseError(networkError("ECONNREFUSED"), target, "environment")).toEqual({
      problem: "unreachable",
      message:
        "Lintel can't reach Postgres at localhost:5432. Is it running? Start Postgres " +
        "(with Docker: `pnpm db:up`), or remove DATABASE_URL to use the built-in database instead.",
    });
  });

  it("finds the cause inside wrapped errors and Node's IPv4-and-IPv6 AggregateError", () => {
    const aggregate = new AggregateError([
      networkError("ECONNREFUSED"),
      networkError("ECONNREFUSED"),
    ]);
    const wrapped = new Error("Failed query: select 1", { cause: aggregate });

    expect(describeDatabaseError(wrapped, target, "form")).toMatchObject({
      problem: "unreachable",
      message: "Lintel can't reach Postgres at localhost:5432. Is it running?",
    });
  });

  it("explains a wrong password, including how to write special characters", () => {
    const described = describeDatabaseError(
      postgresError("28P01", 'password authentication failed for user "lintel"'),
      target,
      "environment",
    );

    expect(described?.problem).toBe("auth-failed");
    expect(described?.message).toContain('Postgres turned down the password for "lintel".');
    expect(described?.message).toContain("%23, %40 or %2F");
  });

  it("gives the exact command to create a missing database", () => {
    const described = describeDatabaseError(
      postgresError("3D000", 'database "lintel" does not exist'),
      target,
      "environment",
    );

    expect(described?.problem).toBe("not-found");
    expect(described?.message).toContain('There\'s no database called "lintel"');
    expect(described?.message).toContain("createdb -h localhost -p 5432 -U lintel lintel");
    expect(described?.message).toContain('CREATE DATABASE "lintel";');
  });

  it("mentions %-encoding when the URL can't be read", () => {
    const malformed = Object.assign(new TypeError("Invalid URL"), { code: "ERR_INVALID_URL" });

    expect(describeDatabaseError(malformed, target, "environment")).toMatchObject({
      problem: "invalid",
      message: expect.stringContaining("%23, %40 or %2F"),
    });
  });

  it("covers unknown host names, timeouts and refused users", () => {
    expect(describeDatabaseError(networkError("ENOTFOUND"), target, "form")?.message).toContain(
      'can\'t find a computer called "localhost"',
    );
    expect(describeDatabaseError(networkError("CONNECT_TIMEOUT"), target, "form")?.problem).toBe(
      "unreachable",
    );
    expect(
      describeDatabaseError(postgresError("28000", 'role "lintel" does not exist'), target, "form"),
    ).toEqual({
      problem: "auth-failed",
      message: 'Postgres won\'t let "lintel" sign in (role "lintel" does not exist).',
    });
  });

  it("points at .lintel/config.json when the settings came from the setup screen", () => {
    const described = describeDatabaseError(networkError("ECONNREFUSED"), target, "saved-setup");

    expect(described?.message).toContain(".lintel/config.json");
  });

  it("leaves errors that have nothing to do with the database alone", () => {
    expect(describeDatabaseError(new Error("something else"), target, "form")).toBeUndefined();
    expect(describeDatabaseError("not even an error", target, "form")).toBeUndefined();
  });

  it("explains a real refused connection", async () => {
    const databaseUrl = "postgres://lintel@127.0.0.1:1/lintel";
    const error = await checkPostgresConnection(databaseUrl).catch((caught: unknown) => caught);

    expect(describeDatabaseError(error, targetFromUrl(databaseUrl), "form")?.message).toBe(
      "Lintel can't reach Postgres at 127.0.0.1:1. Is it running?",
    );
  });
});

describe("targetFromUrl", () => {
  it("reads and decodes the parts of a DATABASE_URL", () => {
    expect(targetFromUrl("postgres://ana%40work:secret@db.example.com:6543/my%20site")).toEqual({
      host: "db.example.com",
      port: 6543,
      database: "my site",
      user: "ana@work",
    });
  });
});
