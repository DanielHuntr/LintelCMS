import { describe, expect, it } from "vitest";
import { HttpError } from "../http/http-errors.js";
import { EventBus } from "./event-bus.js";

const entry = {
  id: "00000000-0000-4000-8000-000000000001",
  collection: "pages",
  slug: "about",
  title: "About",
  url: "/about",
  status: "published",
  publishedAt: null,
};

function createBus() {
  const failures: string[] = [];
  const bus = new EventBus({
    onListenerError: (_error, listenerName, event) =>
      failures.push(`${listenerName}:${event.name}`),
  });
  return { bus, failures };
}

describe("the event bus", () => {
  it("tells listeners of that event, and listeners of every event, in order", async () => {
    const { bus } = createBus();
    const heard: string[] = [];
    bus.on(
      "entry.published",
      "first",
      (event) => void heard.push(`first ${event.data.entry.title}`),
    );
    bus.onEvery("everything", (event) => void heard.push(`every ${event.name}`));
    bus.on("asset.uploaded", "assets", () => void heard.push("assets"));

    const published = await bus.publish("entry.published", { entry });

    expect(heard).toEqual(["first About", "every entry.published"]);
    expect(published.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(published.actor).toBeNull();
  });

  it("keeps telling the others when one listener fails", async () => {
    const { bus, failures } = createBus();
    const heard: string[] = [];
    bus.onEvery("broken", () => {
      throw new Error("down");
    });
    bus.onEvery("working", () => void heard.push("working"));

    await bus.publish("entry.deleted", { entry });

    expect(failures).toEqual(["broken:entry.deleted"]);
    expect(heard).toEqual(["working"]);
  });

  it("lets checks refuse, and passes their error on", async () => {
    const { bus } = createBus();
    const actor = { id: entry.id, name: "Ana", email: "ana@example.com" };
    bus.addCheck("entry.publishing", ({ permissions }) => {
      if (!permissions.includes("*")) throw new HttpError(409, "NO", "Not yet");
    });

    await expect(
      bus.runChecks("entry.publishing", { entry, actor, permissions: [] }),
    ).rejects.toThrow("Not yet");
    await expect(
      bus.runChecks("entry.publishing", { entry, actor, permissions: ["*"] }),
    ).resolves.toBeUndefined();
  });

  it("lists core events, and events features declare", () => {
    const { bus } = createBus();
    bus.declare({
      name: "order.placed",
      label: "An order is placed",
      group: "Shop",
      sampleData: {},
    });

    const names = bus.listDefinitions().map((definition) => definition.name);
    expect(names).toContain("entry.published");
    expect(names).toContain("form.submitted");
    expect(names.at(-1)).toBe("order.placed");
  });
});
