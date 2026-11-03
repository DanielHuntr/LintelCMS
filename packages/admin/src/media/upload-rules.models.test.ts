import { describe, expect, it } from "vitest";
import { acceptedFileTypes, acceptedModelTypes, findUploadProblem } from "./upload-rules.js";

describe("upload rules for 3D models", () => {
  const file = (name: string, size = 1000) => ({ name, size });

  it("takes .glb and .gltf in the library and the model picker", () => {
    expect(acceptedFileTypes).toContain(".glb");
    expect(acceptedModelTypes).toBe(".glb,.gltf");
    expect(findUploadProblem(file("vase.glb"))).toBeUndefined();
    expect(findUploadProblem(file("vase.gltf"), { modelsOnly: true })).toBeUndefined();
  });

  it("keeps pictures and models to their own pickers, and says so plainly", () => {
    expect(findUploadProblem(file("vase.glb"), { imagesOnly: true })).toContain("isn’t a kind");
    expect(findUploadProblem(file("photo.jpg"), { modelsOnly: true })).toContain(
      "isn’t a 3D model",
    );
  });

  it("holds models to the same upload limit", () => {
    expect(findUploadProblem(file("big.glb", 26 * 1024 * 1024))).toBeDefined();
  });
});
