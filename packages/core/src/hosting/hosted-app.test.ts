import { EventEmitter } from "node:events";
import { createServer, type Server } from "node:http";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreparedProductionServer } from "../production/start-production-server.js";
import { type HostedApp, type HostedAppOptions, startHostedApp } from "./hosted-app.js";

const SETTINGS = { PUBLIC_URL: "https://example.com", NODE_ENV: "production" };

function fakeLintel(): FastifyInstance {
  const server = Fastify();
  server.get("/", async () => "the website");
  server.get("/admin", async () => "the admin");
  server.get("/api/setup/status", async () => ({ needsSetup: true }));
  return server;
}

async function prepared(server: FastifyInstance): Promise<PreparedProductionServer> {
  await server.ready();
  return {
    server,
    addresses: {
      port: 4000,
      publicUrl: "https://example.com",
      publicApiUrl: "https://example.com/api",
      adminOrigin: "https://example.com",
      adminUrl: "https://example.com/admin",
    },
    storageDescription: "local disk",
  };
}

describe("the hosted startup (app.js)", () => {
  let app: HostedApp | undefined;
  let front: Server | undefined;

  afterEach(async () => {
    await new Promise((resolve) => (front ? front.close(resolve) : resolve(undefined)));
    await app?.close();
    app = undefined;
    front = undefined;
  });

  /** Sends requests to the app's handler, as Passenger's socket would. */
  async function serve(hosted: HostedApp): Promise<string> {
    front = createServer(hosted.handleRequest);
    await new Promise<void>((resolve) => front?.listen(0, "127.0.0.1", resolve));
    const address = front.address();
    return `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  }

  function start(options: Partial<HostedAppOptions>) {
    app = startHostedApp({
      startedDirectly: false,
      environment: SETTINGS,
      signals: new EventEmitter(),
      exit: vi.fn(),
      ...options,
    });
    return app;
  }

  it("takes over from Passenger and serves every address from one handler", async () => {
    const passenger = { configure: vi.fn(), on: vi.fn() };
    const listen = vi.fn();
    let finishStarting = () => {};
    const started = new Promise<void>((resolve) => (finishStarting = resolve));
    const hosted = start({
      passenger,
      listen,
      prepare: async () => {
        await started;
        return prepared(fakeLintel());
      },
    });

    expect(hosted.mode).toEqual({ kind: "passenger" });
    expect(passenger.configure).toHaveBeenCalledWith({ autoInstall: false });
    expect(listen).toHaveBeenCalledWith(expect.anything(), { kind: "passenger" });
    expect(passenger.on).toHaveBeenCalledWith("exit", expect.any(Function));

    const address = await serve(hosted);
    // A request that arrives while Lintel is starting waits for it.
    const early = fetch(`${address}/`);
    finishStarting();
    expect(await (await early).text()).toBe("the website");
    expect(await (await fetch(`${address}/admin`)).text()).toBe("the admin");
    expect(await (await fetch(`${address}/api/setup/status`)).json()).toEqual({ needsSetup: true });
  });

  it("closes Lintel cleanly when Passenger asks it to stop", async () => {
    const passenger = { configure: vi.fn(), on: vi.fn() };
    const exit = vi.fn();
    const server = fakeLintel();
    const onClose = vi.fn();
    server.addHook("onClose", async () => onClose());
    const hosted = start({ passenger, listen: vi.fn(), exit, prepare: () => prepared(server) });
    await hosted.ready;

    const stop = passenger.on.mock.calls[0]?.[1] as () => void;
    stop();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows why Lintel couldn't start instead of the host's error page", async () => {
    const hosted = start({
      passenger: { configure: vi.fn() },
      listen: vi.fn(),
      environment: { NODE_ENV: "production" },
      prepare: async () => prepared(fakeLintel()),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await fetch(`${await serve(hosted)}/admin`);
    expect(response.status).toBe(503);
    const page = await response.text();
    expect(page).toContain("Lintel couldn't start");
    expect(page).toContain("PUBLIC_URL isn't set");
  });

  it("doesn't show the details of an unexpected failure to visitors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hosted = start({
      listen: vi.fn(),
      startedDirectly: true,
      prepare: async () => {
        throw new Error("secret internal detail");
      },
    });

    const page = await (await fetch(`${await serve(hosted)}/`)).text();
    expect(page).not.toContain("secret internal detail");
    expect(page).toContain("stderr.log");
  });

  it("listens on PORT for `node app.js`", () => {
    const listen = vi.fn();
    const hosted = start({
      startedDirectly: true,
      listen,
      environment: { ...SETTINGS, PORT: "4321", HOST: "127.0.0.1" },
      prepare: async () => prepared(fakeLintel()),
    });
    expect(hosted.mode).toEqual({ kind: "port", port: 4321, host: "127.0.0.1" });
    expect(listen).toHaveBeenCalledWith(expect.anything(), hosted.mode);
  });
});

describe("app.js, the startup file", () => {
  let folder: string | undefined;
  afterEach(async () => {
    if (folder) await rm(folder, { recursive: true, force: true });
  });

  it("passes Passenger along and exports a handler that waits for Lintel", async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-app-js-"));
    await cp(join(import.meta.dirname, "files", "app.cjs"), join(folder, "app.js"));
    const hosting = join(folder, "packages", "core", "dist", "hosting");
    await mkdir(hosting, { recursive: true });
    await writeFile(join(folder, "packages", "core", "package.json"), '{"type":"module"}');
    await writeFile(
      join(hosting, "hosted-app.js"),
      `export function startHostedApp(options) {
        globalThis.startedWith = options;
        return { handleRequest: (request, response) => response.end("handled " + request.url) };
      }`,
    );
    const passenger = { configure: () => {} };
    vi.stubGlobal("PhusionPassenger", passenger);

    const handler = createRequire(import.meta.url)(join(folder, "app.js")) as ((
      ...parameters: Parameters<HostedApp["handleRequest"]>
    ) => void) & { lintel: Promise<unknown> };
    await handler.lintel;
    vi.unstubAllGlobals();

    const startedWith = (globalThis as { startedWith?: Record<string, unknown> }).startedWith;
    expect(startedWith).toEqual({ passenger, startedDirectly: false });
    const server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    expect(await (await fetch(`http://127.0.0.1:${port}/about`)).text()).toBe("handled /about");
    await new Promise((resolve) => server.close(resolve));
  });
});
