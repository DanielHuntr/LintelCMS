import { describe, expect, it, vi } from "vitest";
import { LiveClient } from "./LiveClient.js";
import { retryDelay } from "./liveSocket.js";
import { liveAddress } from "./useLiveClient.js";

function clientWithFakeLink() {
  const sent: Record<string, unknown>[] = [];
  let events: Parameters<ConstructorParameters<typeof LiveClient>[0]>[0];
  const client = new LiveClient((given) => {
    events = given;
    return {
      send: (text) => sent.push(JSON.parse(text) as Record<string, unknown>),
      close: () => undefined,
    };
  }, "my-tab");
  return {
    client,
    sent,
    up: () => events.onUp(),
    down: (status: "offline" | "unavailable" | "signedOut" = "offline") => events.onDown(status),
    hear: (message: Record<string, unknown>) => events.onMessage(JSON.stringify(message)),
  };
}

const entryId = "00000000-0000-4000-8000-000000000001";

describe("this tab's end of the live connection", () => {
  it("says nothing while the connection is down", () => {
    const { client, sent } = clientWithFakeLink();
    client.send({ type: "stopWatchingSite" });
    expect(sent).toEqual([]);
  });

  it("says what a screen wants as soon as it can, and again after reconnecting", () => {
    const { client, sent, up, down } = clientWithFakeLink();
    client.keep("page", { type: "enterPage", entryId, view: "design" });
    expect(sent).toEqual([]);
    up();
    expect(sent).toHaveLength(1);
    down();
    up();
    expect(sent).toHaveLength(2);
    expect(sent[1]).toEqual({ type: "enterPage", entryId, view: "design", tab: "my-tab" });
  });

  it("stops saying it once the screen has gone", () => {
    const { client, sent, up, down } = clientWithFakeLink();
    client.keep("page", { type: "enterPage", entryId, view: "design" });
    up();
    client.forget("page", { type: "leavePage", entryId });
    down();
    up();
    expect(sent.map((message) => message.type)).toEqual(["enterPage", "leavePage"]);
  });

  it("keeps things in the order they were asked for, when reconnecting", () => {
    const { client, sent, up } = clientWithFakeLink();
    client.keep("page", { type: "enterPage", entryId, view: "design" });
    client.keep("design", { type: "openDesign", entryId, field: "design" });
    up();
    expect(sent.map((message) => message.type)).toEqual(["enterPage", "openDesign"]);
  });

  it("only hears what is for this tab", () => {
    const { client, up, hear } = clientWithFakeLink();
    const listener = vi.fn();
    client.listen(listener);
    up();
    hear({ type: "pong", tab: "another-tab" });
    expect(listener).not.toHaveBeenCalled();
    hear({ type: "pong", tab: "my-tab" });
    expect(listener).toHaveBeenCalledOnce();
  });

  it("vouches for nobody when the connection is down", () => {
    const { client, up, down, hear } = clientWithFakeLink();
    up();
    const people = [{ id: "1", name: "Sam", avatarUrl: null, view: "design" }];
    hear({ type: "peopleHere", tab: "my-tab", entryId, people });
    expect(client.peopleOn(entryId)).toHaveLength(1);
    down();
    expect(client.peopleOn(entryId)).toHaveLength(0);
  });
});

describe("reconnecting", () => {
  const noJitter = () => 0.5;

  it("waits longer after each failure", () => {
    expect(retryDelay(0, noJitter)).toBe(1000);
    expect(retryDelay(1, noJitter)).toBe(2000);
    expect(retryDelay(3, noJitter)).toBe(8000);
  });

  it("hardly tries at all once it looks blocked", () => {
    expect(retryDelay(5, noJitter)).toBe(300_000);
  });

  it("spreads browsers out, so a restart isn't met by everyone at once", () => {
    expect(retryDelay(2, () => 0)).toBeLessThan(retryDelay(2, () => 1));
  });
});

describe("the connection's address", () => {
  it("follows the API's, secure when that is", () => {
    expect(liveAddress("https://example.com/api")).toBe("wss://example.com/api/live");
    expect(liveAddress("http://localhost:4000")).toBe("ws://localhost:4000/live");
  });
});
