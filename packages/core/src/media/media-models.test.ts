import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { useMediaTestServer } from "../testing/test-media.js";
import { packGltfAsGlb } from "./model-files.js";

/** The 3D model element's files: .glb kept as it is, a self-contained .gltf packed into one. */

const vase = readFileSync(
  createRequire(import.meta.url).resolve("@lintel/motion/sample-models/vase.glb"),
);

/** A tiny glTF triangle with its buffer inside it, as some tools export. */
function triangleGltf(bufferUri: string) {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return JSON.stringify({
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
    buffers: [
      {
        byteLength: positions.byteLength,
        uri:
          bufferUri ||
          `data:application/octet-stream;base64,${Buffer.from(positions.buffer).toString("base64")}`,
      },
    ],
    images: [{ uri: "data:image/png;base64,iVBORw0KGgo=" }],
  });
}

describe("3D model files", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  it("keeps a .glb, lists it as a model and lets pages on other addresses fetch it", async () => {
    const response = await media.upload("Vase.glb", vase);

    expect(response.statusCode).toBe(201);
    const asset = response.json();
    expect(asset).toMatchObject({
      filename: "Vase.glb",
      mimeType: "model/gltf-binary",
      size: vase.length,
      width: null,
      thumbnailUrl: null,
    });
    const file = await media.server.inject({ url: `/media/${asset.id}/file` });
    expect(file.headers["content-type"]).toBe("model/gltf-binary");
    expect(file.headers["access-control-allow-origin"]).toBe("*");
    expect(file.rawPayload.equals(vase)).toBe(true);

    const list = (type: string) =>
      media.server.inject({ url: `/media?type=${type}`, cookies: media.adminCookies });
    expect((await list("model")).json().assets.map((item: { id: string }) => item.id)).toEqual([
      asset.id,
    ]);
    expect((await list("document")).json().assets).toEqual([]);
    expect((await list("image")).json().assets).toEqual([]);
  });

  it("serves the sample models to the builder, and nothing else from their folder", async () => {
    const sample = await media.server.inject({ url: "/media/sample-models/vase.glb" });
    expect(sample.statusCode).toBe(200);
    expect(sample.headers["access-control-allow-origin"]).toBe("*");
    expect(sample.rawPayload.equals(vase)).toBe(true);
    const other = await media.server.inject({ url: "/media/sample-models/..%2Fpackage.json" });
    expect(other.statusCode).toBe(404);
  });

  it("packs a self-contained .gltf into a .glb", async () => {
    const response = await media.upload("triangle.gltf", Buffer.from(triangleGltf("")));

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      filename: "triangle.glb",
      mimeType: "model/gltf-binary",
    });
    const file = await media.server.inject({ url: `/media/${response.json().id}/file` });
    expect(file.rawPayload.subarray(0, 4).toString("latin1")).toBe("glTF");
  });

  it("refuses a .gltf that points to files that weren't uploaded, saying what to do", async () => {
    const response = await media.upload("triangle.gltf", Buffer.from(triangleGltf("triangle.bin")));

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: "UNREADABLE_MODEL" });
    expect(response.json().message).toContain("single .glb file");
  });

  it("refuses a broken .glb and any other JSON called .gltf", async () => {
    const broken = Buffer.concat([vase.subarray(0, 12), Buffer.from("not json at all")]);
    expect((await media.upload("broken.glb", broken)).statusCode).toBe(422);
    expect((await media.upload("data.gltf", Buffer.from('{"name":"x"}'))).statusCode).toBe(415);
    const odd = { asset: { version: "2.0" }, buffers: "none" };
    expect((await media.upload("odd.gltf", Buffer.from(JSON.stringify(odd)))).statusCode).toBe(422);
    // A size with no data behind it is refused, not set aside in memory.
    const empty = { asset: { version: "2.0" }, buffers: [{ byteLength: 1e12 }] };
    expect((await media.upload("empty.gltf", Buffer.from(JSON.stringify(empty)))).statusCode).toBe(
      422,
    );
  });
});

describe("packing a .gltf", () => {
  it("moves pictures held as data addresses into the binary part", () => {
    const glb = packGltfAsGlb(triangleGltf(""), "triangle.gltf");
    const jsonLength = glb.readUInt32LE(12);
    const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as {
      buffers: Array<{ uri?: string; byteLength: number }>;
      bufferViews: Array<{ byteOffset: number; byteLength: number }>;
      images: Array<{ uri?: string; bufferView: number; mimeType: string }>;
    };
    expect(json.buffers).toEqual([{ byteLength: 44 }]);
    expect(json.images[0]).toEqual({ bufferView: 1, mimeType: "image/png" });
    expect(json.bufferViews[1]).toMatchObject({ byteOffset: 36, byteLength: 8 });
    expect(glb.readUInt32LE(8)).toBe(glb.length);
  });
});
