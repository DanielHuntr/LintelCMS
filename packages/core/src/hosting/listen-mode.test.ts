import { describe, expect, it } from "vitest";
import { chooseListenMode, type ListenSituation } from "./listen-mode.js";

const plainNode: ListenSituation = {
  passengerIsPresent: false,
  startedDirectly: true,
  environment: {},
  port: 4000,
  host: "0.0.0.0",
};

describe("how the hosted startup file listens", () => {
  it("hands over to Passenger's socket under Passenger, whatever PORT says", () => {
    const mode = chooseListenMode({
      ...plainNode,
      passengerIsPresent: true,
      startedDirectly: false,
      environment: { PORT: "3000" },
    });
    expect(mode).toEqual({ kind: "passenger" });
  });

  it("listens on the port for `node app.js`", () => {
    expect(chooseListenMode(plainNode)).toEqual({ kind: "port", port: 4000, host: "0.0.0.0" });
  });

  it("listens when a wrapper loads app.js and sets PORT (LiteSpeed's lsnode)", () => {
    const mode = chooseListenMode({
      ...plainNode,
      startedDirectly: false,
      environment: { PORT: "5123" },
      port: 5123,
    });
    expect(mode).toEqual({ kind: "port", port: 5123, host: "0.0.0.0" });
  });

  it("only exports the handler when loaded by a wrapper that sets no port", () => {
    const mode = chooseListenMode({ ...plainNode, startedDirectly: false });
    expect(mode).toEqual({ kind: "handler-only" });
  });

  it("does what LINTEL_LISTEN says", () => {
    expect(
      chooseListenMode({
        ...plainNode,
        passengerIsPresent: true,
        environment: { LINTEL_LISTEN: "false" },
      }),
    ).toEqual({ kind: "handler-only" });
    expect(
      chooseListenMode({
        ...plainNode,
        startedDirectly: false,
        environment: { LINTEL_LISTEN: "true" },
      }).kind,
    ).toBe("port");
  });
});
