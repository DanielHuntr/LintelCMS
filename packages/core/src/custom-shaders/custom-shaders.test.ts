import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { writeSetting } from "../settings/settings.service.js";
import { listAllSites } from "../sites/sites.service.js";
import { readShadersForPages } from "./custom-shaders.service.js";

const testDatabase = useTestDatabase();

const code = `// @name Rings
uniform float rings; // @slider "How many" min=1 max=9 value=3
void main(){gl_FragColor=vec4(vec3(fract(length(uv)*rings)),1.);}`;

describe("the site's shaders", () => {
  let api: FastifyInstance;
  let owner: SendRequest;

  const allowCode = () =>
    writeSetting(testDatabase.database, "builderCustomScripts", "allowScripts");
  const personWith = async (email: string, permissions: string[]) => {
    await createTestUser(testDatabase.database, email, [permissions]);
    return requestsAs(api, await signInAndGetCookies(api, email));
  };

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(async () => {
    await api.close();
  });

  it("can't be saved until the site allows custom code", async () => {
    expect((await owner("GET", "/website/shaders")).json()).toEqual({
      shaders: [],
      allowed: false,
    });
    const refused = await owner("PUT", "/website/shaders/rings", { name: "Rings", code });
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({ code: "CUSTOM_CODE_OFF" });
  });

  it("saves, changes and deletes one, for the whole site", async () => {
    await allowCode();
    const saved = await owner("PUT", "/website/shaders/rings", { name: "Rings", code });
    expect(saved.statusCode).toBe(200);
    await owner("PUT", "/website/shaders/rings", { name: "Rings two", code });
    const { shaders, allowed } = (await owner("GET", "/website/shaders")).json();
    expect(allowed).toBe(true);
    expect(shaders).toEqual([{ id: "rings", name: "Rings two", code }]);
    expect((await owner("DELETE", "/website/shaders/rings")).statusCode).toBe(204);
    expect((await owner("GET", "/website/shaders")).json().shaders).toEqual([]);
  });

  it("refuses code that fails the checks, naming the line", async () => {
    await allowCode();
    const refused = await owner("PUT", "/website/shaders/bad", {
      name: "Bad",
      code: `void main(){\n  while(true){}\n}`,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().fields.code).toContain("Line 2:");
    const large = await owner("PUT", "/website/shaders/big", {
      name: "Big",
      code: " ".repeat(17_000),
    });
    expect(large.statusCode).toBe(400);
  });

  it("refuses an id that isn't a plain name", async () => {
    await allowCode();
    const response = await owner("PUT", "/website/shaders/Not%20OK", { name: "A", code });
    expect(response.statusCode).toBe(400);
  });

  it("lets designers use them, and only people with code permission write them", async () => {
    await allowCode();
    await owner("PUT", "/website/shaders/rings", { name: "Rings", code });
    const designer = await personWith("designer@example.com", ["builder:design"]);
    expect((await designer("GET", "/website/shaders")).json().shaders).toHaveLength(1);
    expect((await designer("PUT", "/website/shaders/a", { name: "A", code })).statusCode).toBe(403);
    expect((await designer("DELETE", "/website/shaders/rings")).statusCode).toBe(403);
    const coder = await personWith("coder@example.com", ["builder:code"]);
    expect((await coder("PUT", "/website/shaders/a", { name: "A", code })).statusCode).toBe(403);
    const client = await personWith("client@example.com", ["entries:read"]);
    expect((await client("GET", "/website/shaders")).statusCode).toBe(403);
    const both = await personWith("both@example.com", ["builder:design", "builder:code"]);
    expect((await both("PUT", "/website/shaders/a", { name: "A", code })).statusCode).toBe(200);
  });

  it("reaches pages only while the site allows custom code", async () => {
    await allowCode();
    await owner("PUT", "/website/shaders/rings", { name: "Rings", code });
    const [site] = await listAllSites(testDatabase.database);
    expect(await readShadersForPages(testDatabase.database, site!)).toEqual({ rings: code });
    await writeSetting(testDatabase.database, "builderCustomScripts", "removeScripts");
    expect(await readShadersForPages(testDatabase.database, site!)).toEqual({});
  });
});
