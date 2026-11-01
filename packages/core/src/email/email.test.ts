import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type FakeSmtpServer, startFakeSmtpServer } from "../testing/fake-smtp-server.js";
import { createConfiguredEmailDriver } from "./configured-email.js";
import { EmailNotSentError, InvalidEmailError } from "./email.errors.js";
import type { OutgoingEmail } from "./email.schema.js";
import { createEmailSender } from "./email.service.js";
import { OutboxEmailDriver } from "./outbox-email-driver.js";
import { PostmarkEmailDriver } from "./postmark-email-driver.js";
import { ResendEmailDriver } from "./resend-email-driver.js";
import { SmtpEmailDriver } from "./smtp-email-driver.js";

const welcome: OutgoingEmail = {
  from: "Lintel <hello@example.com>",
  to: ["ana@example.com"],
  subject: "Welcome to the team",
  text: "You can now sign in.",
  html: "<p>You can now sign in.</p>",
  replyTo: "support@example.com",
};

/** A fetch that records what it was asked and answers as a sending service would. */
function fakeFetch(status: number, answer: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(answer), { status });
  };
  return { fetch, calls };
}

describe("sending email", () => {
  it("fills in the sender and sends one recipient as a list", async () => {
    const outbox = new OutboxEmailDriver();
    const email = createEmailSender(outbox, { defaultFrom: "Site <site@example.com>" });

    await email.send({ to: "ana@example.com", subject: "Hello", text: "Hi Ana" });

    expect(outbox.sent[0]).toMatchObject({
      from: "Site <site@example.com>",
      to: ["ana@example.com"],
      subject: "Hello",
    });
  });

  it("refuses a message without a recipient or subject, saying what is wrong", async () => {
    const email = createEmailSender(new OutboxEmailDriver(), { defaultFrom: "site@example.com" });

    await expect(email.send({ to: "not an address", subject: "", text: "Hi" })).rejects.toThrow(
      InvalidEmailError,
    );
    await expect(email.send({ to: [], subject: "Hi", text: "Hi" })).rejects.toThrow(
      /Who should the email go to/,
    );
  });
});

describe("the outbox", () => {
  let folder: string;
  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-outbox-"));
  });
  afterAll(() => rm(folder, { recursive: true, force: true }));

  it("keeps each email as a file to read later, instead of sending it", async () => {
    const outbox = new OutboxEmailDriver(join(folder, "outbox"));
    await outbox.send(welcome);
    await outbox.send({ ...welcome, subject: "Second" });

    const kept = await outbox.readFolder();
    expect(kept.map((email) => email.subject)).toEqual(["Welcome to the team", "Second"]);
  });

  it("is what an install gets until another driver is chosen", () => {
    const driver = createConfiguredEmailDriver(
      { EMAIL_DRIVER: "outbox", SMTP_PORT: 587, POSTMARK_MESSAGE_STREAM: "outbound" },
      folder,
    );
    expect(driver).toBeInstanceOf(OutboxEmailDriver);
  });
});

describe("Resend", () => {
  it("posts the email to Resend's API with the key", async () => {
    const { fetch, calls } = fakeFetch(200, { id: "resend-123" });

    const result = await new ResendEmailDriver("re_secret", fetch).send(welcome);

    expect(result.messageId).toBe("resend-123");
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer re_secret");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      from: welcome.from,
      to: welcome.to,
      subject: welcome.subject,
      text: welcome.text,
      html: welcome.html,
      reply_to: welcome.replyTo,
    });
  });

  it("explains a refused key and repeats Resend's own message", async () => {
    const { fetch } = fakeFetch(401, { message: "API key is invalid" });

    const sending = new ResendEmailDriver("wrong", fetch).send(welcome);
    await expect(sending).rejects.toBeInstanceOf(EmailNotSentError);
    await expect(new ResendEmailDriver("wrong", fetch).send(welcome)).rejects.toThrow(
      /refused the API key.*API key is invalid/,
    );
  });

  it("says when the service can't be reached", async () => {
    const offline = async () => {
      throw new TypeError("fetch failed");
    };
    await expect(new ResendEmailDriver("key", offline).send(welcome)).rejects.toThrow(
      /couldn't reach the service \(fetch failed\)/,
    );
  });
});

describe("Postmark", () => {
  it("posts the email to Postmark's API in its own field names", async () => {
    const { fetch, calls } = fakeFetch(200, { MessageID: "pm-1", ErrorCode: 0 });

    const result = await new PostmarkEmailDriver("pm-token", "outbound", fetch).send({
      ...welcome,
      to: ["ana@example.com", "ben@example.com"],
    });

    expect(result.messageId).toBe("pm-1");
    expect(new Headers(calls[0]?.init.headers).get("x-postmark-server-token")).toBe("pm-token");
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      From: welcome.from,
      To: "ana@example.com, ben@example.com",
      TextBody: welcome.text,
      HtmlBody: welcome.html,
      MessageStream: "outbound",
    });
  });

  it("explains an unverified sender", async () => {
    const { fetch } = fakeFetch(422, { ErrorCode: 400, Message: "Sender signature not found" });

    await expect(
      new PostmarkEmailDriver("pm-token", "outbound", fetch).send(welcome),
    ).rejects.toThrow(/domain isn't verified.*Sender signature not found/);
  });
});

describe("SMTP", () => {
  let smtp: FakeSmtpServer;
  beforeAll(async () => {
    smtp = await startFakeSmtpServer({ user: "lintel", password: "mail password" });
  });
  afterAll(() => smtp.close());

  function driver(password: string) {
    return new SmtpEmailDriver({
      host: "127.0.0.1",
      port: smtp.port,
      secure: false,
      user: "lintel",
      password,
    });
  }

  it("signs in to the mail server and hands over the message", async () => {
    const smtpDriver = driver("mail password");
    await smtpDriver.send(welcome);
    smtpDriver.close();

    const [mail] = smtp.received;
    expect(mail?.from).toBe("hello@example.com");
    expect(mail?.to).toEqual(["ana@example.com"]);
    expect(mail?.data).toContain("Subject: Welcome to the team");
  });

  it("points at the user name and password when they are refused", async () => {
    const smtpDriver = driver("wrong password");
    await expect(smtpDriver.send(welcome)).rejects.toThrow(/SMTP_USER and SMTP_PASSWORD/);
    smtpDriver.close();
  });
});
