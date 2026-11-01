import { describe, expect, it } from "vitest";
import { sanitiseFilename } from "./filenames.js";
import { cropAroundFocalPoint, coverPositionForFocalPoint } from "./focal-crop.js";
import { assertSvgIsSafe } from "./svg-safety.js";

describe("sanitiseFilename", () => {
  it.each([
    ["Summer Menu.pdf", "pdf", "Summer Menu.pdf"],
    ["C:\\Users\\ana\\Desktop\\logo.PNG", "png", "logo.png"],
    ["../../secret.png", "png", "secret.png"],
    ["  ..hidden  .png", "png", "hidden.png"],
    ['bad<>:"|?*name\u0000.png', "png", "badname.png"],
    ["photo.png", "jpg", "photo.jpg"],
    ["....", "png", "file.png"],
  ])("cleans %j", (original, extension, expected) => {
    expect(sanitiseFilename(original, extension)).toBe(expected);
  });

  it("keeps long names under 120 characters", () => {
    expect(sanitiseFilename(`${"a".repeat(300)}.png`, "png")).toHaveLength(120);
  });
});

describe("assertSvgIsSafe", () => {
  it("allows ordinary drawings, styles and links", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
      '<style>.a{fill:red}</style><a href="https://example.com"><circle class="a" r="4"/></a></svg>';
    expect(() => assertSvgIsSafe(svg, "logo.svg")).not.toThrow();
  });

  it.each([
    '<svg><set attributeName="href" to="javascript:alert(1)"/></svg>',
    '<svg><image xlink:href="data:image/svg+xml;base64,PHN2Zz4="/></svg>',
    '<!DOCTYPE svg [<!ENTITY a "boom">]><svg>&a;</svg>',
    "<svg><a href='java&#x09;script:alert(1)'/></svg>",
    "<svg><style>@import url(https://evil.example/x.css)</style></svg>",
  ])("refuses %s", (svg) => {
    expect(() => assertSvgIsSafe(svg, "logo.svg")).toThrow(/could run code/);
  });
});

describe("cropAroundFocalPoint", () => {
  it("centres the crop on the focal point and keeps it inside the image", () => {
    expect(cropAroundFocalPoint(400, 200, 1, { x: 0.5, y: 0.5 })).toEqual({
      left: 100,
      top: 0,
      width: 200,
      height: 200,
    });
    expect(cropAroundFocalPoint(400, 200, 1, { x: 0.95, y: 0.5 }).left).toBe(200);
    expect(cropAroundFocalPoint(400, 200, 1, { x: 0, y: 0.5 }).left).toBe(0);
    expect(cropAroundFocalPoint(400, 200, 4, { x: 0.5, y: 0.1 })).toEqual({
      left: 0,
      top: 0,
      width: 400,
      height: 100,
    });
  });

  it("gives matching CSS positions for previews", () => {
    expect(coverPositionForFocalPoint(2, 1, { x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
    expect(coverPositionForFocalPoint(2, 1, { x: 0.95, y: 0.5 })).toEqual({ x: 1, y: 0.5 });
    expect(coverPositionForFocalPoint(2, 1, { x: 0.375, y: 0 }).x).toBeCloseTo(0.25);
  });
});
