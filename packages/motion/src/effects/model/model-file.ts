/**
 * Reading a model file's own description before handing it to three.js: which glTF
 * extensions it needs. A .glb starts with "glTF", its version and length, then a JSON
 * chunk. Plain functions so tests can check them without WebGL.
 */

const GLB_MAGIC = 0x46546c67; // "glTF", little-endian
const JSON_CHUNK = 0x4e4f534a; // "JSON"

export interface ModelDescription {
  extensionsUsed: string[];
  extensionsRequired: string[];
}

/** The JSON part of a .glb (or a whole .gltf), or undefined when it isn't one. */
export function readModelJson(buffer: ArrayBuffer): Record<string, unknown> | undefined {
  const view = new DataView(buffer);
  let text: string;
  if (buffer.byteLength >= 20 && view.getUint32(0, true) === GLB_MAGIC) {
    const length = view.getUint32(12, true);
    if (view.getUint32(16, true) !== JSON_CHUNK || 20 + length > buffer.byteLength) return;
    text = new TextDecoder().decode(new Uint8Array(buffer, 20, length));
  } else {
    text = new TextDecoder().decode(new Uint8Array(buffer));
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

const names = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export function describeModel(buffer: ArrayBuffer): ModelDescription | undefined {
  const json = readModelJson(buffer);
  if (!json) return undefined;
  return {
    extensionsUsed: names(json.extensionsUsed),
    extensionsRequired: names(json.extensionsRequired),
  };
}

/** Draco needs a decoder far bigger than the rest of the viewer, so it isn't supported. */
export const unsupportedExtensions = ["KHR_draco_mesh_compression"] as const;

export function needsMeshopt(description: ModelDescription): boolean {
  return description.extensionsUsed.includes("EXT_meshopt_compression");
}

export function findUnsupportedExtension(description: ModelDescription): string | undefined {
  return unsupportedExtensions.find((name) => description.extensionsRequired.includes(name));
}

/**
 * How sharp to draw: the screen's pixel ratio, at most 2, and at most 1.25 on phones and
 * slow devices, where every extra pixel costs battery.
 */
export function modelPixelRatio(devicePixelRatio: number, lowPower: boolean): number {
  return Math.min(devicePixelRatio || 1, lowPower ? 1.25 : 2);
}

/** The model's turn for a page scrolled `progress` past it: three quarters of a turn in all. */
export function scrollTurn(progress: number): number {
  return (progress - 0.5) * Math.PI * 1.5;
}
