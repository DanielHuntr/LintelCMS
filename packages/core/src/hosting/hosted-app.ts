import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { FastifyInstance } from "fastify";
import { type Config, loadConfig, loadProjectEnvFile } from "../config.js";
import { closeGracefullyOnStop } from "../production/graceful-shutdown.js";
import { productionAddresses } from "../production/production.config.js";
import {
  announceRunning,
  type PreparedProductionServer,
  prepareProductionServer,
} from "../production/start-production-server.js";
import { isExplained } from "../startup.js";
import { chooseListenMode, describeListenMode, type ListenMode } from "./listen-mode.js";
import { startupProblemPage } from "./startup-problem-page.js";

/**
 * What app.js (the startup file in the shared-hosting package) calls. Lintel's one
 * production server (see src/production), started the way the host expects: on Passenger's
 * socket, on PORT, or as a bare request handler (see listen-mode.ts).
 *
 * The listener is opened before the database and the website are ready, because Passenger
 * gives up on apps that are slow to listen; requests that arrive meanwhile wait. If Lintel
 * can't start, every address shows a page that says why, instead of the host's error page.
 */

/** The part of Passenger's global `PhusionPassenger` object Lintel uses. */
export interface PassengerApi {
  configure(options: { autoInstall: boolean }): void;
  /** Passenger asks the app to stop with "exit"; with a listener, the app exits itself. */
  on?(event: "exit", listener: () => void): unknown;
}

export type RequestHandler = (request: IncomingMessage, response: ServerResponse) => void;

export interface HostedAppOptions {
  /** `PhusionPassenger`, when app.js runs under Passenger. */
  passenger?: PassengerApi | undefined;
  /** True for `node app.js`. */
  startedDirectly: boolean;
  environment?: NodeJS.ProcessEnv;
  /** Builds and announces the server. Replaced in tests. */
  prepare?: (config: Config) => Promise<PreparedProductionServer>;
  /** Replaced in tests, which can't use Passenger's socket. */
  listen?: (server: Server, mode: Exclude<ListenMode, { kind: "handler-only" }>) => void;
  /** Called after stopping on a signal or Passenger's "exit". Replaced in tests. */
  exit?: (code: number) => void;
  /** Where SIGTERM and SIGINT come from. Replaced in tests. */
  signals?: { once(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown };
}

export interface HostedApp {
  mode: ListenMode;
  /** Hand a request to Lintel. Requests before it is ready wait for it. */
  handleRequest: RequestHandler;
  /** Settles once Lintel is serving, or showing why it couldn't start. */
  ready: Promise<void>;
  /** The running server, once ready; undefined if Lintel couldn't start. */
  server(): FastifyInstance | undefined;
  close(): Promise<void>;
}

/** Long enough for Passenger to stop the copy it is replacing. */
const WAIT_FOR_PREVIOUS_COPY_SECONDS = 20;

export function startHostedApp(options: HostedAppOptions): HostedApp {
  const environment = options.environment ?? process.env;
  if (environment === process.env) loadProjectEnvFile();

  let config: Config | undefined;
  let configProblem: unknown;
  try {
    config = loadConfig(environment);
  } catch (error) {
    configProblem = error;
  }

  const mode = chooseListenMode({
    passengerIsPresent: options.passenger !== undefined,
    startedDirectly: options.startedDirectly,
    environment,
    port: config ? productionAddresses(config).port : Number(environment.PORT) || 4000,
    host: config?.HOST ?? "0.0.0.0",
  });
  // Without this Passenger would grab the first server that listens, whichever it is.
  options.passenger?.configure({ autoInstall: false });

  let server: FastifyInstance | undefined;
  let handler: RequestHandler | undefined;
  const ready = startLintel(config, configProblem, mode, options).then((result) => {
    server = result.server;
    handler = result.handler;
  });
  const handleRequest: RequestHandler = (request, response) => {
    if (handler) return handler(request, response);
    void ready.then(() => handler?.(request, response));
  };

  const httpServer = createServer(handleRequest);
  if (mode.kind !== "handler-only") {
    (options.listen ?? listenOnHost)(httpServer, mode);
  }

  const close = async () => {
    await ready;
    if (httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeIdleConnections();
      });
    }
    await server?.close();
  };

  if (mode.kind !== "handler-only") {
    stopWhenAsked({ options, close, timeoutSeconds: config?.SHUTDOWN_TIMEOUT_SECONDS ?? 10 });
  }

  return { mode, handleRequest, ready, server: () => server, close };
}

async function startLintel(
  config: Config | undefined,
  configProblem: unknown,
  mode: ListenMode,
  options: HostedAppOptions,
): Promise<{ server?: FastifyInstance; handler: RequestHandler }> {
  try {
    if (!config) throw configProblem;
    if (mode.kind === "passenger" && !config.PUBLIC_URL) {
      throw new PublicUrlMissingError();
    }
    const hostedConfig = adjustForHost(config, mode);
    const prepared = await (options.prepare ?? prepareForHost)(hostedConfig);
    prepared.server.log.info(`Started for shared hosting: ${describeListenMode(mode)}`);
    const routing: RequestHandler = (request, response) =>
      prepared.server.routing(request, response);
    return { server: prepared.server, handler: routing };
  } catch (error) {
    const explained = isExplained(error) || error instanceof PublicUrlMissingError;
    const explanation = explained ? (error as Error).message : undefined;
    console.error(explanation ? `\n${explanation}\n` : error);
    return { handler: showStartupProblem(startupProblemPage(explanation)) };
  }
}

/**
 * Passenger passes requests over a socket only it can reach, adding the visitor's address
 * in X-Forwarded-For, so it is believed unless TRUST_PROXY says otherwise.
 */
function adjustForHost(config: Config, mode: ListenMode): Config {
  if (mode.kind !== "passenger" || process.env.TRUST_PROXY !== undefined) return config;
  return { ...config, TRUST_PROXY: true };
}

async function prepareForHost(config: Config): Promise<PreparedProductionServer> {
  const prepared = await prepareProductionServer(config, {
    waitForDataFolderSeconds: WAIT_FOR_PREVIOUS_COPY_SECONDS,
  });
  await announceRunning(prepared, config);
  return prepared;
}

export class PublicUrlMissingError extends Error {
  constructor() {
    super(
      "PUBLIC_URL isn't set, so Lintel doesn't know its own address. Add an environment " +
        "variable named PUBLIC_URL with your site's address, such as https://example.com " +
        "(in cPanel: Setup Node.js App, edit the app, Environment variables).",
    );
    this.name = "PublicUrlMissingError";
  }
}

function showStartupProblem(page: string): RequestHandler {
  return (_request, response) => {
    response.writeHead(503, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "retry-after": "60",
    });
    response.end(page);
  };
}

function listenOnHost(server: Server, mode: Exclude<ListenMode, { kind: "handler-only" }>): void {
  if (mode.kind === "passenger") {
    server.listen("passenger");
  } else {
    server.listen(mode.port, mode.host);
  }
}

function stopWhenAsked(details: {
  options: HostedAppOptions;
  close: () => Promise<void>;
  timeoutSeconds: number;
}): void {
  const exit = details.options.exit ?? ((code: number) => process.exit(code));
  const log = {
    info: (message: object | string) => console.warn(stringify(message)),
    error: (problem: unknown) => console.error(problem),
  };
  closeGracefullyOnStop(
    { close: details.close, log },
    { timeoutSeconds: details.timeoutSeconds, exit, signals: details.options.signals },
  );
  // With an "exit" listener Passenger waits for the app, so the database closes cleanly.
  details.options.passenger?.on?.("exit", () => {
    details.close().then(
      () => exit(0),
      (error: unknown) => {
        console.error(error);
        exit(1);
      },
    );
  });
}

function stringify(message: object | string): string {
  return typeof message === "string" ? message : JSON.stringify(message);
}
