import { EventEmitter } from "node:events";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { closeGracefullyOnStop, type StoppableServer } from "./graceful-shutdown.js";

function fakeProcess() {
  const signals = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  return { signals, exit };
}

describe("closeGracefullyOnStop", () => {
  it("lets a request in progress finish before closing and exiting cleanly", async () => {
    const server = Fastify();
    let finishRequest = () => {};
    let requestArrived = () => {};
    const arrived = new Promise<void>((resolve) => (requestArrived = resolve));
    server.get("/slow", () => {
      requestArrived();
      return new Promise<string>((resolve) => (finishRequest = () => resolve("done")));
    });
    await server.listen({ port: 0, host: "127.0.0.1" });
    const address = server.addresses()[0];
    const { signals, exit } = fakeProcess();
    closeGracefullyOnStop(server, { timeoutSeconds: 5, signals, exit });

    const slowRequest = fetch(`http://127.0.0.1:${address?.port}/slow`);
    await arrived;
    signals.emit("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(exit).not.toHaveBeenCalled();

    finishRequest();
    expect(await (await slowRequest).text()).toBe("done");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0), { timeout: 8000 });
  });

  it("gives up after the timeout when a request never finishes", async () => {
    vi.useFakeTimers();
    const neverCloses: StoppableServer = {
      log: { info: vi.fn(), error: vi.fn() },
      close: () => new Promise(() => {}),
    };
    const { signals, exit } = fakeProcess();
    closeGracefullyOnStop(neverCloses, { timeoutSeconds: 10, signals, exit });

    signals.emit("SIGINT");
    vi.advanceTimersByTime(10_000);
    expect(exit).toHaveBeenCalledWith(1);
    vi.useRealTimers();
  });
});
