import { describe, expect, it } from "vitest";
import { DevOutbox } from "./dev-outbox.js";
import type { EmailMessage } from "./email-sender.js";

describe("the development outbox", () => {
  it("keeps every message and tells the log, without sending anything", async () => {
    const logged: EmailMessage[] = [];
    const outbox = new DevOutbox((message) => logged.push(message));

    await outbox.sendEmail({ to: ["owner@example.com"], subject: "Hello", text: "Hi there" });

    expect(outbox.sent).toEqual([
      { to: ["owner@example.com"], subject: "Hello", text: "Hi there" },
    ]);
    expect(logged).toHaveLength(1);
    outbox.clear();
    expect(outbox.sent).toEqual([]);
  });

  it("drops the oldest messages once it holds a hundred", async () => {
    const outbox = new DevOutbox();
    for (let number = 1; number <= 105; number += 1) {
      await outbox.sendEmail({ to: ["a@example.com"], subject: `Message ${number}`, text: "" });
    }

    expect(outbox.sent).toHaveLength(100);
    expect(outbox.sent[0]?.subject).toBe("Message 6");
  });
});
