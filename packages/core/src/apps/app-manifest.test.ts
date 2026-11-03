import { describe, expect, it } from "vitest";
import { appManifestSchema, isSecureAppAddress } from "./app-manifest.schema.js";
import { permissionsForScopes } from "./app-scopes.js";

const smallest = {
  name: "Hello",
  handle: "hello",
  description: "Says hello.",
  appUrl: "https://hello.example.com",
};

function problemsWith(manifest: object): string[] {
  const result = appManifestSchema.safeParse(manifest);
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}

describe("lintel-app.json", () => {
  it("needs only a name, handle, description and address, and fills in the rest", () => {
    expect(appManifestSchema.parse(smallest)).toEqual({
      ...smallest,
      scopes: [],
      webhooks: [],
      admin: { dashboardWidgets: [], editorPanels: [] },
    });
  });

  it("accepts every part of the admin an app can add", () => {
    const origin = "https://shop-tools.example.com";
    const parsed = appManifestSchema.parse({
      ...smallest,
      appUrl: origin,
      icon: `${origin}/icon.png`,
      scopes: ["read_content", "read_media"],
      webhooks: [{ event: "asset.uploaded", url: "https://hooks.example.net/lintel" }],
      admin: {
        page: { label: "Shop tools", url: `${origin}/admin` },
        dashboardWidgets: [
          {
            id: "orders",
            title: "Orders",
            description: "Today's orders",
            url: `${origin}/w`,
            size: "large",
          },
        ],
        editorPanels: [
          { id: "check", title: "Checks", url: `${origin}/p`, collections: ["posts"] },
        ],
        settingsPage: { url: `${origin}/settings` },
      },
    });
    // Webhooks may go to another server: often the app's backend lives elsewhere.
    expect(parsed.webhooks[0]?.url).toBe("https://hooks.example.net/lintel");
    expect(parsed.admin.dashboardWidgets[0]?.size).toBe("large");
  });

  it("keeps every embedded page on the app's own origin", () => {
    expect(
      problemsWith({
        ...smallest,
        icon: "https://cdn.example.org/icon.png",
        admin: { page: { label: "Hi", url: "https://evil.example.org/admin" } },
      }),
    ).toEqual([
      "The icon address must be on https://hello.example.com, the app's own address",
      "The admin.page.url address must be on https://hello.example.com, the app's own address",
    ]);
  });

  it("refuses plain http except on this computer", () => {
    expect(problemsWith({ ...smallest, appUrl: "http://hello.example.com" })).toEqual([
      "Addresses need to start with https:// (http:// only works for localhost)",
    ]);
    expect(problemsWith({ ...smallest, appUrl: "http://localhost:3100" })).toEqual([]);
    expect(isSecureAppAddress(new URL("javascript:alert(1)"))).toBe(false);
    expect(isSecureAppAddress(new URL("http://127.0.0.1:3100/page"))).toBe(true);
  });

  it("refuses unknown scopes and events, repeats, and webhooks without the scope to read them", () => {
    expect(problemsWith({ ...smallest, scopes: ["manage_users"] })[0]).toContain(
      "Scopes are one of",
    );
    expect(problemsWith({ ...smallest, scopes: ["read_media", "read_media"] })).toEqual([
      "Each scope only needs to be listed once",
    ]);
    expect(
      problemsWith({
        ...smallest,
        webhooks: [{ event: "user.created", url: "https://hello.example.com/hooks" }],
      })[0],
    ).toContain("Webhook events are one of");
    expect(
      problemsWith({
        ...smallest,
        scopes: ["read_media"],
        webhooks: [{ event: "entry.deleted", url: "https://hello.example.com/hooks" }],
      }),
    ).toEqual(["The entry.deleted webhook needs the read_content scope"]);
  });

  it("checks handles and ids, and that ids aren't used twice", () => {
    const widget = { title: "A", description: "B", url: "https://hello.example.com/w" };
    expect(problemsWith({ ...smallest, handle: "Hello World" })[0]).toContain("lowercase letters");
    expect(
      problemsWith({
        ...smallest,
        admin: {
          dashboardWidgets: [
            { ...widget, id: "same" },
            { ...widget, id: "same" },
          ],
        },
      }),
    ).toEqual(['The id "same" is used twice']);
  });
});

describe("scopes", () => {
  it("add up to permissions that never include settings, users or roles", () => {
    const everything = permissionsForScopes([
      "read_content",
      "write_content",
      "publish_content",
      "read_media",
      "write_media",
    ]);
    expect(everything).toContain("entries:publish");
    expect(everything.some((permission) => /^(settings|users|roles):/.test(permission))).toBe(
      false,
    );
  });
});
