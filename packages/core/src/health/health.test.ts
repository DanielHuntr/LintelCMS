import { afterAll, describe, expect, it } from "vitest";
import { ActiveDatabase } from "../database/active-database.js";
import { connectToPostgres } from "../database/postgres-database.js";
import { buildServer } from "../server.js";

describe("GET /health", () => {
  // Nothing listens at this address. That is the point: the connection only opens on the
  // first query, and /health must answer without one.
  const unreachableDatabase = new ActiveDatabase(
    connectToPostgres("postgres://lintel@localhost:1/no_database"),
    "environment",
  );
  const server = buildServer({
    adminOrigin: "http://localhost:5173",
    database: unreachableDatabase,
  });

  afterAll(async () => {
    await server.close();
    await unreachableDatabase.close();
  });

  it("reports that the server is running", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
