import { describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useFormsTestServer } from "../testing/test-forms.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("the form builder", () => {
  const testDatabase = useTestDatabase();
  const forms = useFormsTestServer(testDatabase);

  it("starts a form from a template, emailing whoever made it", async () => {
    const response = await forms.api("POST", "/forms", { name: "Contact us", template: "contact" });

    expect(response.statusCode).toBe(201);
    const form = response.json();
    expect(form).toMatchObject({
      handle: "contact_us",
      name: "Contact us",
      submitLabel: "Send message",
      confirmation: { type: "message" },
      notifications: {
        notifyOwner: true,
        recipients: ["owner@example.com"],
        subject: "New message from {name}",
        confirmationEmail: { enabled: false },
      },
      retentionDays: null,
      acceptingSubmissions: true,
      submissionCount: 0,
      unreadCount: 0,
    });
    expect(form.fields.map((field: { handle: string }) => field.handle)).toEqual([
      "name",
      "email",
      "phone",
      "message",
      "consent",
    ]);
  });

  it("has every template ready, each one valid as it is", async () => {
    for (const template of ["blank", "contact", "newsletter", "quote_request", "event_booking"]) {
      const created = await forms.api("POST", "/forms", { name: `A ${template}`, template });
      expect(created.statusCode).toBe(201);
      const resaved = await forms.api("PATCH", `/forms/${created.json().id}`, {
        fields: created.json().fields,
      });
      expect(resaved.statusCode).toBe(200);
    }
    const list = await forms.api("GET", "/forms");
    expect(list.json().forms).toHaveLength(5);
  });

  it("gives each new form its own handle, and refuses a handle already in use", async () => {
    const first = await forms.createForm("Contact");
    const second = await forms.createForm("Contact");
    expect([first.handle, second.handle]).toEqual(["contact", "contact_2"]);

    const clash = await forms.api("PATCH", `/forms/${second.id}`, { handle: "contact" });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({ code: "HANDLE_TAKEN" });
  });

  it("saves fields, steps, the confirmation and retention, and checks them", async () => {
    const form = await forms.createForm("Booking");
    const fields = [
      { id: "a", type: "step", handle: "you", label: "About you" },
      { id: "b", type: "shortText", handle: "name", label: "Name", required: true },
      {
        id: "c",
        type: "dropdown",
        handle: "time",
        label: "Time",
        options: { choices: ["Am", "Pm"] },
      },
      {
        id: "d",
        type: "file",
        handle: "cv",
        label: "CV",
        options: { allowedKinds: ["documents"] },
      },
    ];
    const saved = await forms.api("PATCH", `/forms/${form.id}`, {
      fields,
      submitLabel: "Book",
      confirmation: { type: "redirect", url: "/thanks" },
      retentionDays: 30,
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      submitLabel: "Book",
      confirmation: { type: "redirect", url: "/thanks" },
      retentionDays: 30,
    });
    expect(saved.json().fields[3].options).toEqual({
      allowedKinds: ["documents"],
      maxMegabytes: 10,
      maxFiles: 1,
    });

    const problems = await forms.api("PATCH", `/forms/${form.id}`, {
      fields: [
        { id: "x", type: "dropdown", handle: "pick", label: "Pick", options: { choices: [] } },
        { id: "y", type: "shortText", handle: "pick", label: "Again" },
      ],
      confirmation: { type: "redirect", url: "javascript:alert(1)" },
    });
    expect(problems.statusCode).toBe(400);
    expect(problems.json().message).toContain("Pick: Add at least one choice");
    expect(problems.json().message).toContain("should start with https://, http:// or /");

    const sameHandle = await forms.api("PATCH", `/forms/${form.id}`, {
      fields: [
        { id: "x", type: "shortText", handle: "pick", label: "Pick" },
        { id: "y", type: "shortText", handle: "pick", label: "Again" },
      ],
    });
    expect(sameHandle.json().message).toContain('Two fields have the handle "pick"');
  });

  it("deletes a form with its submissions", async () => {
    const form = await forms.createForm("Contact", "contact");
    await forms.submit(form, {
      name: "Ana",
      email: "ana@example.com",
      message: "Hi",
      consent: true,
    });

    expect((await forms.api("DELETE", `/forms/${form.id}`)).statusCode).toBe(204);
    expect((await forms.api("GET", `/forms/${form.id}`)).statusCode).toBe(404);
    expect((await forms.api("GET", "/forms/not-an-id")).statusCode).toBe(404);
  });

  it("needs forms permissions, and settings:update for the Turnstile keys", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["forms:read"]]);
    const reader = await signInAndGetCookies(forms.server, "reader@example.com");

    const signedOut = await forms.server.inject({ method: "GET", url: "/forms" });
    const list = await forms.server.inject({ method: "GET", url: "/forms", cookies: reader });
    const create = await forms.server.inject({
      method: "POST",
      url: "/forms",
      cookies: reader,
      payload: { name: "Nope" },
    });
    const keys = await forms.server.inject({
      method: "PUT",
      url: "/forms/settings",
      cookies: reader,
      payload: { turnstileSiteKey: "site" },
    });

    expect(signedOut.statusCode).toBe(401);
    expect(list.statusCode).toBe(200);
    expect(create.statusCode).toBe(403);
    expect(keys.statusCode).toBe(403);
  });

  it("keeps the Turnstile secret out of sight once saved", async () => {
    const saved = await forms.api("PUT", "/forms/settings", {
      turnstileSiteKey: "0x4AAA-site",
      turnstileSecretKey: "0x4AAA-secret",
    });
    expect(saved.json()).toEqual({ turnstileSiteKey: "0x4AAA-site", hasTurnstileSecret: true });

    const keptSecret = await forms.api("PUT", "/forms/settings", {
      turnstileSiteKey: "0x4AAA-new",
    });
    expect(keptSecret.json()).toEqual({ turnstileSiteKey: "0x4AAA-new", hasTurnstileSecret: true });

    const removed = await forms.api("PUT", "/forms/settings", {
      turnstileSiteKey: "",
      turnstileSecretKey: null,
    });
    expect(removed.json()).toEqual({ turnstileSiteKey: null, hasTurnstileSecret: false });
  });

  it("answers 404 everywhere while the Forms plugin is off, and keeps the forms", async () => {
    const form = await forms.createForm("Contact", "contact");
    await forms.api("PUT", "/plugins", { enabled: [] });

    const admin = await forms.api("GET", "/forms");
    const publicForm = await forms.server.inject({ method: "GET", url: "/delivery/forms/contact" });
    expect(admin.statusCode).toBe(404);
    expect(admin.json()).toMatchObject({ code: "FORMS_SWITCHED_OFF" });
    expect(publicForm.statusCode).toBe(404);

    await forms.api("PUT", "/plugins", { enabled: ["forms"] });
    expect((await forms.api("GET", `/forms/${form.id}`)).statusCode).toBe(200);
  });

  it("adds a Form section to pages when the plugin is switched on", async () => {
    await forms.api("PUT", "/plugins", { enabled: [] });
    await ensurePagesCollection(testDatabase.database);
    await forms.api("PUT", "/plugins", { enabled: ["forms"] });

    const page = await forms.api("GET", "/blueprints/page");
    const sections = page
      .json()
      .fields.find((field: { handle: string }) => field.handle === "sections");
    const formBlock = sections.options.blockTypes.find(
      (type: { handle: string }) => type.handle === "form",
    );
    expect(formBlock.fields.map((field: { type: string }) => field.type)).toEqual(["text", "form"]);

    // Switching it off and on again doesn't add a second one.
    await forms.api("PUT", "/plugins", { enabled: [] });
    await forms.api("PUT", "/plugins", { enabled: ["forms"] });
    const again = await forms.api("GET", "/blueprints/page");
    const blockTypes = again
      .json()
      .fields.find((field: { handle: string }) => field.handle === "sections").options.blockTypes;
    expect(blockTypes.filter((type: { handle: string }) => type.handle === "form")).toHaveLength(1);
  });

  it("keeps collections from taking the forms address", async () => {
    const response = await forms.api("POST", "/collections", {
      handle: "forms",
      name: "Forms",
      blueprint: "page",
    });
    expect(response.statusCode).toBe(400);
  });
});
