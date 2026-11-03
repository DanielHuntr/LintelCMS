// Writes the sample 3D models offered as "Try a sample" (sample-models/*.glb). They are made
// here from three.js's geometry, so they are Lintel's own and free of anyone else's licence.
// Run after changing a shape: node scripts/make-sample-models.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { LatheGeometry, SplineCurve, TorusKnotGeometry, Vector2 } from "three";

const folder = fileURLToPath(new URL("../sample-models/", import.meta.url));

/** A smooth outline through (radius, height) pairs, as points for a lathe. */
function smooth(points, divisions) {
  return new SplineCurve(points.map(([radius, height]) => new Vector2(radius, height))).getPoints(
    divisions,
  );
}

/** A disc's outline: a flat face with raised rings, a rounded rim and a hollow back. */
function discOutline() {
  const points = [new Vector2(0.001, 0.07)];
  for (const [from, to] of [
    [0.2, 0.26],
    [0.46, 0.5],
    [0.66, 0.69],
  ]) {
    points.push(new Vector2(from, 0.07), new Vector2(from + 0.015, 0.11));
    points.push(new Vector2(to - 0.015, 0.11), new Vector2(to, 0.07));
  }
  const rim = smooth(
    [
      [0.8, 0.07],
      [0.9, 0.04],
      [0.92, 0],
      [0.9, -0.04],
      [0.8, -0.06],
    ],
    12,
  );
  return [...points, ...rim, new Vector2(0.14, -0.06), new Vector2(0.001, -0.03)];
}

// Colours are linear, as glTF stores them: a terracotta glaze, brass and a deep green.
const samples = [
  {
    file: "vase.glb",
    name: "Ceramic vase",
    // Foot, belly, neck and a rolled lip, then back down the inside.
    geometry: new LatheGeometry(
      smooth(
        [
          [0.001, 0],
          [0.3, 0],
          [0.36, 0.05],
          [0.55, 0.4],
          [0.5, 0.8],
          [0.26, 1.08],
          [0.2, 1.3],
          [0.26, 1.42],
          [0.23, 1.45],
          [0.17, 1.33],
          [0.15, 1.1],
          [0.001, 1.04],
        ],
        56,
      ),
      48,
    ),
    material: { colour: [0.52, 0.17, 0.08, 1], metallic: 0, roughness: 0.3 },
  },
  {
    file: "disc.glb",
    name: "Brass disc",
    geometry: new LatheGeometry(discOutline(), 72).rotateX(Math.PI / 3.2),
    material: { colour: [0.71, 0.42, 0.13, 1], metallic: 1, roughness: 0.3 },
  },
  {
    file: "knot.glb",
    name: "Knot",
    geometry: new TorusKnotGeometry(0.6, 0.2, 128, 16, 2, 3),
    material: { colour: [0.02, 0.11, 0.1, 1], metallic: 0, roughness: 0.4 },
  },
];

function pad(length) {
  return (4 - (length % 4)) % 4;
}

function writeGlb({ file, name, geometry, material }) {
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const positions = geometry.getAttribute("position").array;
  const normals = geometry.getAttribute("normal").array;
  const index = geometry.getIndex().array;
  const count = positions.length / 3;
  const indices = count < 65536 ? Uint16Array.from(index) : Uint32Array.from(index);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let at = 0; at < positions.length; at++) {
    min[at % 3] = Math.min(min[at % 3], positions[at]);
    max[at % 3] = Math.max(max[at % 3], positions[at]);
  }
  const parts = [Float32Array.from(positions), Float32Array.from(normals), indices];
  const views = [];
  let offset = 0;
  for (const part of parts) {
    views.push({ buffer: 0, byteOffset: offset, byteLength: part.byteLength });
    offset += part.byteLength + pad(part.byteLength);
  }
  views[0].target = views[1].target = 34962;
  views[2].target = 34963;
  const binary = new Uint8Array(offset);
  parts.forEach((part, at) => binary.set(new Uint8Array(part.buffer), views[at].byteOffset));
  const json = {
    asset: { version: "2.0", generator: "Lintel sample models" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [
      {
        name,
        primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }],
      },
    ],
    materials: [
      {
        name,
        pbrMetallicRoughness: {
          baseColorFactor: material.colour,
          metallicFactor: material.metallic,
          roughnessFactor: material.roughness,
        },
      },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count, type: "VEC3" },
      {
        bufferView: 2,
        componentType: count < 65536 ? 5123 : 5125,
        count: indices.length,
        type: "SCALAR",
      },
    ],
    bufferViews: views,
    buffers: [{ byteLength: binary.byteLength }],
  };
  let text = JSON.stringify(json);
  text += " ".repeat(pad(text.length));
  const jsonBytes = new TextEncoder().encode(text);
  const total = 12 + 8 + jsonBytes.length + 8 + binary.length;
  const glb = new Uint8Array(total);
  const view = new DataView(glb.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  glb.set(jsonBytes, 20);
  view.setUint32(20 + jsonBytes.length, binary.length, true);
  view.setUint32(24 + jsonBytes.length, 0x004e4942, true);
  glb.set(binary, 28 + jsonBytes.length);
  writeFileSync(`${folder}${file}`, glb);
  process.stdout.write(`${file}: ${(total / 1024).toFixed(0)} kB\n`);
}

samples.forEach(writeGlb);
