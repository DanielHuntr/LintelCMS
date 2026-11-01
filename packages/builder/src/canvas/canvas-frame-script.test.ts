import { describe, expect, it } from "vitest";
import { canvasFrameScript, canvasFrameSource } from "./canvas-frame-script.js";

describe("the canvas frame's document", () => {
  it("carries its script inline by default", () => {
    expect(canvasFrameSource()).toContain(`<script>${canvasFrameScript()}</script>`);
  });

  it("loads its scripts from files when the host serves them, for a strict Content-Security-Policy", () => {
    const site = {
      stylesheet: "",
      bodyClassName: "lintel-template-clean",
      headerHtml: "",
      footerHtml: "",
      baseUrl: null,
      motionScript: "window.lintelMotion = {};",
    };
    const source = canvasFrameSource(site, {
      frame: "https://example.com/admin/canvas-frame.js",
      motion: "https://example.com/admin/canvas-motion.js",
    });
    expect(source).toContain('<script src="https://example.com/admin/canvas-frame.js"></script>');
    expect(source).toContain('<script src="https://example.com/admin/canvas-motion.js"></script>');
    expect(source).not.toContain("<script>");
  });

  it("is a script that runs on its own", () => {
    expect(canvasFrameScript()).toMatch(/^\(function|^\(\(\)|^\(/);
    expect(canvasFrameScript().trimEnd().endsWith(")();")).toBe(true);
  });
});
