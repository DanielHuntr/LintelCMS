/**
 * How the hosted startup file (app.js) receives requests. Hosts differ:
 *
 *   - Passenger (cPanel's "Setup Node.js App", Plesk, Dreamhost) runs app.js itself and
 *     hands requests over on a socket it chooses: `listen("passenger")`.
 *   - `node app.js` in a terminal, a systemd service or pm2 listens on PORT.
 *   - Some wrappers (LiteSpeed's lsnode) require app.js and catch whatever it listens on,
 *     so a PORT they set means "listen".
 *   - A wrapper that only wants the request handler (module.exports) gets just that.
 *
 * LINTEL_LISTEN=true or false overrides the guess.
 */
export type ListenMode =
  { kind: "passenger" } | { kind: "port"; port: number; host: string } | { kind: "handler-only" };

export interface ListenSituation {
  passengerIsPresent: boolean;
  /** `node app.js`: app.js is the main module. */
  startedDirectly: boolean;
  environment: { LINTEL_LISTEN?: string | undefined; PORT?: string | undefined };
  port: number;
  host: string;
}

export function chooseListenMode(situation: ListenSituation): ListenMode {
  const override = situation.environment.LINTEL_LISTEN?.trim().toLowerCase();
  if (override === "false" || override === "no") return { kind: "handler-only" };
  if (situation.passengerIsPresent) return { kind: "passenger" };

  const listensOnPort =
    situation.startedDirectly ||
    override === "true" ||
    override === "yes" ||
    (situation.environment.PORT ?? "").trim() !== "";
  return listensOnPort
    ? { kind: "port", port: situation.port, host: situation.host }
    : { kind: "handler-only" };
}

export function describeListenMode(mode: ListenMode): string {
  switch (mode.kind) {
    case "passenger":
      return "Passenger hands requests over";
    case "port":
      return `listening on port ${mode.port}`;
    case "handler-only":
      return "the host calls the exported request handler";
  }
}
