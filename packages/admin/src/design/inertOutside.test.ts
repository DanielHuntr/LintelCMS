import { describe, expect, it } from "vitest";
import { inertOutside } from "./inertOutside.js";

describe("inertOutside", () => {
  it("makes everything but the element inert, and puts back only what it changed", () => {
    document.body.innerHTML = `
      <a id="skip" href="#main">Skip</a>
      <div id="frame">
        <main id="main"></main>
        <div id="already" inert></div>
        <div id="holder"><button id="launcher">?</button><aside id="panel"><button>Close</button></aside></div>
      </div>`;
    const panel = document.getElementById("panel") as HTMLElement;
    const restore = inertOutside(panel);
    for (const id of ["skip", "main", "launcher"]) {
      expect(document.getElementById(id)).toHaveAttribute("inert");
    }
    expect(panel.closest("[inert]")).toBeNull();

    restore();
    for (const id of ["skip", "main", "launcher"]) {
      expect(document.getElementById(id)).not.toHaveAttribute("inert");
    }
    expect(document.getElementById("already")).toHaveAttribute("inert");
  });
});
