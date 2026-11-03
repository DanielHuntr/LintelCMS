import { describe, expect, it } from "vitest";
import {
  describeModel,
  findUnsupportedExtension,
  modelPixelRatio,
  needsMeshopt,
  scrollTurn,
} from "./model-file.js";

/** A .glb holding only its JSON chunk, as the sample models' script writes them. */
function glb(json: object): ArrayBuffer {
  let text = JSON.stringify(json);
  while (text.length % 4) text += " ";
  const bytes = new Uint8Array(20 + text.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, text.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(new TextEncoder().encode(text), 20);
  return bytes.buffer;
}

describe("reading a model file", () => {
  it("finds the extensions a .glb uses and needs", () => {
    const description = describeModel(
      glb({
        asset: { version: "2.0" },
        extensionsUsed: ["EXT_meshopt_compression", "KHR_draco_mesh_compression"],
        extensionsRequired: ["KHR_draco_mesh_compression"],
      }),
    );
    expect(description && needsMeshopt(description)).toBe(true);
    expect(description && findUnsupportedExtension(description)).toBe("KHR_draco_mesh_compression");
  });

  it("reads a .gltf's JSON too, and refuses anything else", () => {
    const gltf = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" } }));
    expect(describeModel(gltf.buffer)).toEqual({ extensionsUsed: [], extensionsRequired: [] });
    expect(describeModel(new TextEncoder().encode("not a model").buffer)).toBeUndefined();
    expect(describeModel(new ArrayBuffer(0))).toBeUndefined();
  });
});

describe("drawing a model gently", () => {
  it("caps the pixel ratio, lower on phones", () => {
    expect(modelPixelRatio(3, false)).toBe(2);
    expect(modelPixelRatio(3, true)).toBe(1.25);
    expect(modelPixelRatio(1, true)).toBe(1);
    expect(modelPixelRatio(0, false)).toBe(1);
  });

  it("faces forward mid-screen when turning with the scroll", () => {
    expect(scrollTurn(0.5)).toBe(0);
    expect(scrollTurn(1)).toBeCloseTo((Math.PI * 3) / 4);
  });
});
