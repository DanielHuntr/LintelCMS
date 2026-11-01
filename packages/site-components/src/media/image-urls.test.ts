import { describe, expect, it } from "vitest";
import { photo } from "../testing.js";
import { imageSources, resizedImageUrl } from "./image-urls.js";

describe("image addresses", () => {
  it("ask the media server for a focal-point crop of the wanted shape, as WebP", () => {
    expect(resizedImageUrl(photo, 768, 16 / 9)).toBe(
      "http://localhost:4000/media/6f1c2a8e/file?v=abc&w=768&h=432&fit=cover&format=webp",
    );
    expect(resizedImageUrl({ ...photo, url: "/media/1/file" }, 480, null)).toBe(
      "/media/1/file?w=480&format=webp",
    );
  });

  it("offer standard widths up to the original's, never enlarging it", () => {
    const widths = imageSources({ ...photo, width: 1000 }, null).map((source) => source.width);
    expect(widths).toEqual([480, 768, 1000]);
    const heights = imageSources(photo, null).map((source) => source.height);
    expect(heights[0]).toBe(360);
  });
});
