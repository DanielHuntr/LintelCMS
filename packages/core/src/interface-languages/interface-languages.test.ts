import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { readDeploymentInterfaceLanguage } from "./deployment-interface-language.js";

describe("interface languages", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let admin: SendRequest;
  let editor: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, { defaultInterfaceLanguage: "en" });
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:read"]]);
    admin = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
  });

  afterEach(() => server.close());

  it("uses the site's default until someone picks their own", async () => {
    const signedOut = await server.inject({ method: "GET", url: "/interface-language" });
    expect(signedOut.json()).toEqual({ personal: null, siteDefault: "en", active: "en" });

    const siteDefault = await admin("PUT", "/interface-language/site-default", {
      language: "fr-ca",
    });
    expect(siteDefault.json()).toEqual({ personal: null, siteDefault: "fr-CA", active: "fr-CA" });

    const chosen = await editor("PUT", "/interface-language", { language: "ar" });
    expect(chosen.json()).toEqual({ personal: "ar", siteDefault: "fr-CA", active: "ar" });
    expect((await admin("GET", "/interface-language")).json().active).toBe("fr-CA");

    const cleared = await editor("PUT", "/interface-language", { language: null });
    expect(cleared.json().active).toBe("fr-CA");
  });

  it("refuses things that aren't language tags", async () => {
    const response = await editor("PUT", "/interface-language", { language: "not a language" });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("isn't a language tag");
  });

  it("only lets people who manage settings change the site's default", async () => {
    const response = await editor("PUT", "/interface-language/site-default", { language: "de" });
    expect(response.statusCode).toBe(403);
  });
});

describe("the deployment's interface language", () => {
  const configFile = { contents: { interfaceLanguage: "de-de" }, folder: "." };

  it("comes from the environment, then lintel.config.json, then English", () => {
    expect(
      readDeploymentInterfaceLanguage(configFile, { LINTEL_DEFAULT_INTERFACE_LANGUAGE: "nl" }),
    ).toBe("nl");
    expect(readDeploymentInterfaceLanguage(configFile, {})).toBe("de-DE");
    expect(readDeploymentInterfaceLanguage({ contents: {}, folder: "." }, {})).toBe("en");
  });
});
