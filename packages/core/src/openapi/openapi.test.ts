import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { openApiOperations } from "./openapi-operations.js";

/** The paths websites and scripts use; every route under them must be documented. */
const documentedAreas = [
  /^\/delivery\//,
  /^\/entries\//,
  /^\/collections\/[^/]+\/entries/,
  /^\/media/,
  /^\/graphql$/,
  /^\/sitemap\.xml$/,
  /^\/robots\.txt$/,
];

describe("the OpenAPI document", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  const routes: { method: string; path: string }[] = [];

  beforeEach(async () => {
    routes.length = 0;
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      publicApiUrl: "https://api.example.com",
    });
    server.addHook("onRoute", (route) => {
      const methods = Array.isArray(route.method) ? route.method : [route.method];
      for (const method of methods) {
        routes.push({ method: method.toLowerCase(), path: route.url });
      }
    });
    await server.ready();
  });

  afterEach(() => server.close());

  it("is served publicly as OpenAPI 3.1, with the API's own address", async () => {
    const response = await server.inject({ method: "GET", url: "/openapi.json" });

    expect(response.statusCode).toBe(200);
    const document = response.json();
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "https://api.example.com" }]);
    expect(document.components.securitySchemes.apiToken).toMatchObject({ scheme: "bearer" });
  });

  it("describes requests and responses with the same Zod schemas the routes use", async () => {
    const document = (await server.inject({ method: "GET", url: "/openapi.json" })).json();

    const list = document.paths["/delivery/{collection}"].get;
    expect(list.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "collection", in: "path", required: true }),
        expect.objectContaining({ name: "perPage", in: "query", required: false }),
      ]),
    );
    const perPage = list.parameters.find(
      (parameter: { name: string }) => parameter.name === "perPage",
    );
    expect(perPage.schema).toMatchObject({ maximum: 100, default: 25 });
    expect(list.responses["200"].content["application/json"].schema.properties).toHaveProperty(
      "items",
    );

    const create = document.paths["/collections/{handle}/entries"].post;
    expect(create["x-permission"]).toBe("entries:create");
    expect(create.requestBody.content["application/json"].schema.required).toEqual(["data"]);

    const upload = document.paths["/media"].post;
    expect(upload.requestBody.content).toHaveProperty("multipart/form-data");
  });

  it("lists every route websites and scripts can use, and only routes that exist", () => {
    const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");
    const served = routes
      .filter((route) => route.method !== "head" && route.method !== "options")
      .map((route) => `${route.method} ${toOpenApiPath(route.path)}`);
    const documented = openApiOperations.map(
      (operation) => `${operation.method} ${operation.path}`,
    );

    const undocumented = served.filter(
      (route) =>
        documentedAreas.some((area) => area.test(route.split(" ")[1] ?? "")) &&
        !documented.includes(route),
    );
    expect(undocumented).toEqual([]);
    expect(documented.filter((operation) => !served.includes(operation))).toEqual([]);
  });
});
