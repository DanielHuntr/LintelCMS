/** What shutting down needs from the server: a Fastify instance has both. */
export interface StoppableServer {
  close(): PromiseLike<unknown>;
  /** The Node HTTP server underneath. */
  server?: { closeIdleConnections?(): void };
  log: {
    info(details: object | string, message?: string): void;
    error(details: unknown, message?: string): void;
  };
}

export interface ShutdownOptions {
  /** How long requests in progress get to finish before the process gives up on them. */
  timeoutSeconds: number;
  /** Replaced in tests. */
  signals?: { once(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown };
  exit?: (code: number) => void;
}

/**
 * When the platform stops Lintel (SIGTERM on a deploy or restart, Ctrl+C in a terminal),
 * stop taking new requests, let the ones in progress finish, then close the database
 * cleanly. If that takes longer than the timeout, exit anyway: platforms kill a process that
 * doesn't stop, and leaving on our own terms gets a line in the log saying why.
 */
export function closeGracefullyOnStop(server: StoppableServer, options: ShutdownOptions): void {
  const signals = options.signals ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  let stopping = false;

  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    server.log.info({ signal }, "Stopping: finishing the requests in progress");

    const timer = setTimeout(() => {
      server.log.error(
        { timeoutSeconds: options.timeoutSeconds },
        "Requests were still running when the shutdown timeout ran out; stopping anyway",
      );
      exit(1);
    }, options.timeoutSeconds * 1000);
    timer.unref();
    // Node closes idle keep-alive connections when closing starts, but one whose request
    // finishes afterwards would stay open until the browser gives up on it.
    const closeIdle = setInterval(() => server.server?.closeIdleConnections?.(), 250);
    closeIdle.unref();

    try {
      await server.close();
      server.log.info("Stopped cleanly");
      exit(0);
    } catch (error) {
      server.log.error(error, "Stopping failed");
      exit(1);
    } finally {
      clearTimeout(timer);
      clearInterval(closeIdle);
    }
  };

  signals.once("SIGTERM", () => void stop("SIGTERM"));
  signals.once("SIGINT", () => void stop("SIGINT"));
}
