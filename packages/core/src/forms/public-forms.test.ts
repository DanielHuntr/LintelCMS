import { registerPluginFormConsent } from "./required-consent.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { makeTestPng } from "../testing/test-media.js";
import { useTestDatabase } from "../testing/test-database.js";
import { useFormsTestServer } from "../testing/test-forms.js";
import { webhookDeliveriesTable } from "../webhooks/webhooks.table.js";
import { formSubmissionsTable } from "./forms.table.js";

const contactAnswers = {
  name: "Ana Lima",
  email: "Ana@Example.com",
  message: "Could you call me back?",
  consent: "on",
};

/** A multipart body with text fields and files, the way a browser's FormData is sent. */
function multipartBody(
  fields: Record<string, string>,
  files: Array<{ name: string; filename: string; contents: Buffer }>,
) {
  const boundary = "----lintel-forms-boundary";
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  for (const file of files) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\n` +
          "Content-Type: application/octet-stream\r\n\r\n",
      ),
      file.contents,
      Buffer.from("\r\n"),
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(parts),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

describe("forms on websites", () => {
  const testDatabase = useTestDatabase();
  const forms = useFormsTestServer(testDatabase);

  it("serves what a website needs to draw the form, with a fresh token, never cached", async () => {
    const form = await forms.createForm("Quote", "quote_request");
    const response = await forms.server.inject({
      method: "GET",
      url: `/delivery/forms/${form.handle}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const schema = response.json();
    expect(schema.steps).toEqual([
      { title: "About you", fields: ["name", "company", "email", "phone"] },
      {
        title: "Your project",
        fields: ["service", "budget", "deadline", "details", "attachments", "consent"],
      },
    ]);
    expect(schema.fields.some((field: { type: string }) => field.type === "step")).toBe(false);
    expect(schema.spamProtection).toMatchObject({
      honeypotField: "_website",
      tokenField: "_token",
      turnstileSiteKey: null,
    });
    expect(schema.spamProtection.token).toMatch(/^\d+\.[\w-]+$/);
    expect(JSON.stringify(schema)).not.toContain("owner@example.com");

    const missing = await forms.server.inject({ method: "GET", url: "/delivery/forms/nothing" });
    expect(missing.statusCode).toBe(404);
  });

  it("stores a submission, emails the owner and the visitor, and tells webhooks", async () => {
    const form = await forms.createForm("Contact", "contact");
    await forms.api("PATCH", `/forms/${form.id}`, {
      notifications: {
        recipients: ["owner@example.com", "team@example.com"],
        subject: "New message from {name}",
        confirmationEmail: {
          enabled: true,
          subject: "Thanks {name}",
          message: "We'll be in touch.",
        },
      },
    });
    await forms.api("POST", "/webhooks", {
      url: "https://hooks.slack.com/services/T000/B000/XXX",
      events: ["form.submitted"],
    });

    const response = await forms.submit(form, contactAnswers);

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({
      received: true,
      confirmation: { type: "message", message: expect.stringContaining("Thanks") },
    });
    const [stored] = await testDatabase.database.select().from(formSubmissionsTable);
    expect(stored?.values).toEqual({
      name: "Ana Lima",
      email: "Ana@Example.com",
      message: "Could you call me back?",
      consent: true,
    });
    expect(stored?.submitterEmail).toBe("ana@example.com");

    const [owner, visitor] = forms.outbox.sent;
    expect(owner).toMatchObject({
      to: ["owner@example.com", "team@example.com"],
      subject: "New message from Ana Lima",
      replyTo: "ana@example.com",
    });
    expect(owner?.text).toContain("Message:\nCould you call me back?");
    expect(owner?.text).toContain(`http://localhost:5173/forms/${form.id}/submissions`);
    expect(visitor).toMatchObject({ to: ["ana@example.com"], subject: "Thanks Ana Lima" });

    const [delivery] = await testDatabase.database.select().from(webhookDeliveriesTable);
    expect(delivery?.event).toBe("form.submitted");
    expect(delivery?.payload).toMatchObject({
      text: expect.stringContaining("New Contact submission from ana@example.com"),
      data: { form: { handle: "contact" }, submission: { values: { name: "Ana Lima" } } },
    });
  });

  it("publishes form.submitted on the event bus, with the answers as fields, for automations", async () => {
    const form = await forms.createForm("Contact", "contact");
    const heard: unknown[] = [];
    forms.server.events.on("form.submitted", "test listener", (event) => {
      heard.push(event);
    });

    await forms.submit(form, contactAnswers);

    expect(heard).toEqual([
      expect.objectContaining({
        name: "form.submitted",
        actor: null,
        data: {
          form: { id: form.id, handle: "contact", name: "Contact" },
          submission: expect.objectContaining({
            fields: expect.objectContaining({ name: "Ana Lima" }),
            submitterEmail: "ana@example.com",
            url: expect.stringContaining(`/forms/${form.id}/submissions?submission=`),
          }),
        },
      }),
    ]);
  });

  it("checks every answer on the server and says what's wrong with each", async () => {
    const form = await forms.createForm("Booking", "event_booking");

    const response = await forms.submit(form, {
      email: "not an email",
      session: "Midnight",
      guests: "12",
      dietary: ["Vegan", "Carnivore"],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({
      name: "Your name is required",
      email: "Email address doesn't look like an email address",
      session: "Which session? should be one of: Morning, Afternoon, Evening",
      guests: "How many people? should be 10 or less",
      dietary: 'Dietary needs doesn\'t have a choice called "Carnivore"',
      consent: "Please tick this box to continue",
    });
    expect(await testDatabase.database.select().from(formSubmissionsTable)).toHaveLength(0);
    expect(forms.outbox.sent).toHaveLength(0);
  });

  it("quietly drops bots caught by the honeypot or by answering too fast", async () => {
    const form = await forms.createForm("Contact", "contact");

    const honeypot = await forms.submit(form, {
      ...contactAnswers,
      _website: "http://spam.example",
    });
    const tooFast = await forms.server.inject({
      method: "POST",
      url: `/delivery/forms/${form.handle}/submissions`,
      payload: { ...contactAnswers, _token: await forms.tokenFor(form, 1) },
    });

    expect(honeypot.statusCode).toBe(201);
    expect(tooFast.statusCode).toBe(201);
    expect(await testDatabase.database.select().from(formSubmissionsTable)).toHaveLength(0);
    expect(forms.outbox.sent).toHaveLength(0);
  });

  it("refuses a missing, altered or day-old token, asking for a reload", async () => {
    const form = await forms.createForm("Contact", "contact");
    const url = `/delivery/forms/${form.handle}/submissions`;
    const token = await forms.tokenFor(form);

    for (const badToken of [undefined, `${token}x`, await forms.tokenFor(form, 25 * 60 * 60)]) {
      const response = await forms.server.inject({
        method: "POST",
        url,
        payload: { ...contactAnswers, _token: badToken },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: "FORM_EXPIRED" });
    }
    // A token is tied to its form.
    const other = await forms.createForm("Other", "contact");
    const wrongForm = await forms.server.inject({
      method: "POST",
      url: `/delivery/forms/${other.handle}/submissions`,
      payload: { ...contactAnswers, _token: token },
    });
    expect(wrongForm.statusCode).toBe(400);
  });

  it("asks Cloudflare Turnstile when both keys are set", async () => {
    const form = await forms.createForm("Contact", "contact");
    await forms.api("PUT", "/forms/settings", {
      turnstileSiteKey: "site-key",
      turnstileSecretKey: "secret-key",
    });

    const schema = await forms.server.inject({
      method: "GET",
      url: `/delivery/forms/${form.handle}`,
    });
    expect(schema.json().spamProtection.turnstileSiteKey).toBe("site-key");

    const withoutAnswer = await forms.submit(form, contactAnswers);
    expect(withoutAnswer.json()).toMatchObject({ code: "TURNSTILE_FAILED" });

    forms.turnstilePasses = false;
    const rejected = await forms.submit(form, { ...contactAnswers, "cf-turnstile-response": "no" });
    expect(rejected.statusCode).toBe(400);

    forms.turnstilePasses = true;
    const accepted = await forms.submit(form, {
      ...contactAnswers,
      "cf-turnstile-response": "yes",
    });
    expect(accepted.statusCode).toBe(201);
    expect(forms.turnstileChecks).toEqual(["no", "yes"]);
  });

  it("limits how often one address can send", async () => {
    const form = await forms.createForm("Contact", "contact");
    const token = await forms.tokenFor(form);
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await forms.server.inject({
        method: "POST",
        url: `/delivery/forms/${form.handle}/submissions`,
        payload: { ...contactAnswers, _token: token },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 10).every((status) => status === 201)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  // LINTEL-DATA-006: a double click's two requests were both stored.
  it("keeps one submission when the same answers are sent twice from one opened form", async () => {
    const form = await forms.createForm("Contact", "contact");
    const token = await forms.tokenFor(form);
    const send = (answers: Record<string, string>) =>
      forms.server.inject({
        method: "POST",
        url: `/delivery/forms/${form.handle}/submissions`,
        payload: { ...answers, _token: token },
      });

    const [first, second] = await Promise.all([send(contactAnswers), send(contactAnswers)]);
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const different = await send({ ...contactAnswers, message: "And one more thing." });
    expect(different.statusCode).toBe(201);

    const stored = await testDatabase.database
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, form.id));
    expect(stored.map((row) => row.values.message).sort()).toEqual([
      "And one more thing.",
      "Could you call me back?",
    ]);
  });

  it("takes files into the media library, within the field's limits", async () => {
    const form = await forms.createForm("Jobs");
    await forms.api("PATCH", `/forms/${form.id}`, {
      fields: [
        { id: "n", type: "shortText", handle: "name", label: "Name" },
        {
          id: "p",
          type: "file",
          handle: "photo",
          label: "Photo",
          required: true,
          options: { allowedKinds: ["images"], maxMegabytes: 1, maxFiles: 1 },
        },
      ],
    });
    const token = await forms.tokenFor(form);
    const url = `/delivery/forms/${form.handle}/submissions`;

    const wrongKind = await forms.server.inject({
      method: "POST",
      url,
      ...multipartBody({ _token: token, name: "Ana" }, [
        { name: "photo", filename: "notes.txt", contents: Buffer.from("plain text") },
      ]),
    });
    expect(wrongKind.statusCode).toBe(400);
    expect(wrongKind.json().fields.photo).toContain("Photo accepts images");

    const accepted = await forms.server.inject({
      method: "POST",
      url,
      ...multipartBody({ _token: token, name: "Ana" }, [
        { name: "photo", filename: "me.png", contents: await makeTestPng(40, 20) },
      ]),
    });
    expect(accepted.statusCode).toBe(201);
    const [stored] = await testDatabase.database.select().from(formSubmissionsTable);
    expect(stored?.assetIds).toHaveLength(1);
    expect(stored?.values.photo).toEqual([
      expect.objectContaining({ filename: "me.png", mimeType: "image/png" }),
    ]);
    const asset = await forms.api("GET", `/media/${stored?.assetIds[0]}`);
    expect(asset.json().uploadedBy).toBeNull();
  });

  it("refuses a 3D model in a field that takes documents", async () => {
    const form = await forms.createForm("Jobs");
    await forms.api("PATCH", `/forms/${form.id}`, {
      fields: [
        {
          id: "c",
          type: "file",
          handle: "cv",
          label: "CV",
          options: { allowedKinds: ["documents"], maxMegabytes: 1, maxFiles: 1 },
        },
      ],
    });
    const token = await forms.tokenFor(form);
    const contents = readFileSync(
      createRequire(import.meta.url).resolve("@lintel/motion/sample-models/vase.glb"),
    );
    const sent = await forms.server.inject({
      method: "POST",
      url: `/delivery/forms/${form.handle}/submissions`,
      ...multipartBody({ _token: token }, [{ name: "cv", filename: "vase.glb", contents }]),
    });
    expect(sent.statusCode).toBe(400);
    expect(sent.json().fields.cv).toContain("CV accepts");
  });

  // Sending the bytes of a library image used to attach that image to the submission, and
  // deleting the spam then deleted the image (a product photo, say) for good.
  it("never deletes a library file a visitor happened to send too", async () => {
    const form = await forms.createForm("Jobs");
    await forms.api("PATCH", `/forms/${form.id}`, {
      fields: [{ id: "p", type: "file", handle: "photo", label: "Photo" }],
    });
    const photo = await makeTestPng(40, 20, 7);
    const uploaded = await forms.server.inject({
      method: "POST",
      url: "/media",
      cookies: forms.cookies,
      ...multipartBody({}, [{ name: "file", filename: "loaf.png", contents: photo }]),
    });
    const libraryImageId = uploaded.json().id as string;

    const sent = await forms.server.inject({
      method: "POST",
      url: `/delivery/forms/${form.handle}/submissions`,
      ...multipartBody({ _token: await forms.tokenFor(form) }, [
        { name: "photo", filename: "spam.png", contents: photo },
      ]),
    });
    expect(sent.statusCode).toBe(201);
    const [spam] = await testDatabase.database.select().from(formSubmissionsTable);
    expect(spam?.values.photo).toEqual([expect.objectContaining({ assetId: libraryImageId })]);

    await forms.api("DELETE", `/forms/${form.id}/submissions/${spam?.id}`);

    expect((await forms.api("GET", `/media/${libraryImageId}`)).statusCode).toBe(200);
  });

  // The builder's Form element said "Choose a form in the Content panel." even with a form
  // chosen, because the canvas had no form to draw.
  it("gives the page builder every form as a page draws it, without step dividers", async () => {
    const form = await forms.createForm("Quote", "quote_request");

    const response = await forms.api("GET", "/website/builder-data");

    const drawn = response
      .json()
      .sampleForms.find((sample: { handle: string }) => sample.handle === form.handle);
    expect(drawn).toMatchObject({ name: "Quote", acceptingSubmissions: true });
    const types = drawn.fields.map((field: { type: string }) => field.type);
    expect(types).toContain("email");
    expect(types).not.toContain("step");
  });

  it("gives the page builder a consent box the website adds to a form (LINTEL-UX-285)", async () => {
    registerPluginFormConsent("forms", async (asked) =>
      asked.handle === "sign_up_here" ? "Yes, you may email me" : null,
    );
    const form = await forms.createForm("Sign up here");

    const response = await forms.api("GET", "/website/builder-data");

    const drawn = response
      .json()
      .sampleForms.find((sample: { handle: string }) => sample.handle === form.handle);
    expect(drawn.fields.at(-1)).toMatchObject({
      type: "consent",
      label: "Yes, you may email me",
      required: true,
    });
  });

  it("works as a plain HTML form, without JavaScript", async () => {
    const form = await forms.createForm("Contact", "contact");
    const token = await forms.tokenFor(form);
    const body = new URLSearchParams({ ...contactAnswers, _token: token }).toString();
    const headers = {
      "content-type": "application/x-www-form-urlencoded",
      accept: "text/html,application/xhtml+xml",
      referer: "https://example.com/contact",
    };
    const url = `/delivery/forms/${form.handle}/submissions`;

    const thanks = await forms.server.inject({ method: "POST", url, headers, payload: body });
    expect(thanks.statusCode).toBe(201);
    expect(thanks.headers["content-type"]).toContain("text/html");
    expect(thanks.body).toContain("Thanks for getting in touch");
    expect(thanks.body).toContain('href="https://example.com/contact"');

    const problems = await forms.server.inject({
      method: "POST",
      url,
      headers,
      payload: new URLSearchParams({ _token: token, name: "<b>Ana</b>" }).toString(),
    });
    expect(problems.statusCode).toBe(400);
    expect(problems.body).toContain("Email address is required");
    expect(problems.body).not.toContain("<b>Ana</b>");

    await forms.api("PATCH", `/forms/${form.id}`, {
      confirmation: { type: "redirect", url: "https://example.com/thank-you" },
    });
    const redirected = await forms.server.inject({ method: "POST", url, headers, payload: body });
    expect(redirected.statusCode).toBe(303);
    expect(redirected.headers.location).toBe("https://example.com/thank-you");

    const [first] = await testDatabase.database
      .select()
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, form.id));
    expect(first?.sourceUrl).toBe("https://example.com/contact");
  });

  it("turns submissions away while the form is closed", async () => {
    const form = await forms.createForm("Contact", "contact");
    await forms.api("PATCH", `/forms/${form.id}`, { acceptingSubmissions: false });

    const response = await forms.submit(form, contactAnswers);
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ code: "FORM_CLOSED" });
  });

  it("serves the embed script, and lets allowed websites post from the browser", async () => {
    const script = await forms.server.inject({ method: "GET", url: "/delivery/forms.js" });
    expect(script.statusCode).toBe(200);
    expect(script.headers["content-type"]).toContain("text/javascript");
    expect(script.body).toContain("window.LintelForms");
    expect(() => new Function(script.body)).not.toThrow();

    await forms.api("PUT", "/delivery-access", {
      requireToken: true,
      allowedOrigins: ["https://example.com"],
    });
    const form = await forms.createForm("Contact", "contact");
    const preflight = await forms.server.inject({
      method: "OPTIONS",
      url: `/delivery/forms/${form.handle}/submissions`,
      headers: { origin: "https://example.com", "access-control-request-method": "POST" },
    });
    expect(preflight.headers["access-control-allow-origin"]).toBe("https://example.com");

    // Forms stay open even when the content API needs a token.
    const schema = await forms.server.inject({
      method: "GET",
      url: `/delivery/forms/${form.handle}`,
    });
    expect(schema.statusCode).toBe(200);
  });
});
