import { afterAll, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";

describe("GET /health", () => {
  const server = buildServer({ adminOrigin: "http://localhost:5173" });

  afterAll(() => server.close());

  it("reports that the server is running", async () => {
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
