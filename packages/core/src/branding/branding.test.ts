import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { lintelBranding } from "./branding.schema.js";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("branding the admin", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let admin: SendRequest;
  let editor: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, {
      publicApiUrl: "https://api.example.com",
      branding: {
        branding: {
          ...lintelBranding,
          productName: "Acme Studio",
          supportEmail: "help@acme.example",
        },
        isCustomised: true,
      },
    });
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "editor@example.com", [["settings:read"]]);
    admin = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
  });

  afterEach(() => server.close());

  it("shows the deployment's branding to everyone, signed in or not", async () => {
    const response = await server.inject({ method: "GET", url: "/branding" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      productName: "Acme Studio",
      supportEmail: "help@acme.example",
      isLintelDefault: false,
      accent: { fill: "#0071e3", onFill: "#ffffff" },
    });
  });

  it("saves changes, serves uploaded pictures, and resets to the deployment's look", async () => {
    const current = (await admin("GET", "/branding/settings")).json();
    expect(current.defaultsFromDeployment).toBe(true);

    const saved = await admin("PUT", "/branding", {
      ...current.branding,
      productName: "Client Portal",
      accentColour: "#0B1F4D",
      favicon: PNG_PIXEL,
      signInMessage: "  ",
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().branding).toMatchObject({
      productName: "Client Portal",
      accentColour: "#0b1f4d",
      signInMessage: null,
      supportEmail: "help@acme.example",
    });

    const publicBranding = (await server.inject({ method: "GET", url: "/branding" })).json();
    expect(publicBranding.favicon).toMatch(
      /^https:\/\/api\.example\.com\/branding\/images\/favicon\?v=[0-9a-f]{12}$/,
    );
    const image = await server.inject({
      method: "GET",
      url: new URL(publicBranding.favicon).pathname,
    });
    expect(image.statusCode).toBe(200);
    expect(image.headers["content-type"]).toBe("image/png");
    expect(image.headers["content-security-policy"]).toContain("default-src 'none'");

    const reset = await admin("DELETE", "/branding");
    expect(reset.json().branding.productName).toBe("Acme Studio");
    expect(reset.json().branding.favicon).toBeNull();
  });

  it("explains a colour or picture it can't use", async () => {
    const current = (await admin("GET", "/branding/settings")).json();
    const wrongColour = await admin("PUT", "/branding", {
      ...current.branding,
      accentColour: "teal",
    });
    expect(wrongColour.statusCode).toBe(400);
    expect(wrongColour.json().message).toContain("#7539FD");

    const wrongPicture = await admin("PUT", "/branding", {
      ...current.branding,
      logo: "data:text/html;base64,PHNjcmlwdD4=",
    });
    expect(wrongPicture.statusCode).toBe(400);
  });

  it("is only changed by people who may change branding", async () => {
    expect((await editor("GET", "/branding/settings")).statusCode).toBe(403);
    expect((await editor("DELETE", "/branding")).statusCode).toBe(403);
    expect((await server.inject({ method: "DELETE", url: "/branding" })).statusCode).toBe(401);
  });

  it("answers 404 for a picture that was never uploaded", async () => {
    const response = await server.inject({ method: "GET", url: "/branding/images/logo" });
    expect(response.statusCode).toBe(404);
  });
});
