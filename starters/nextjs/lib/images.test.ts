import { describe, expect, it } from "vitest";
import type { DeliveredImage } from "./content-types";
import { imageUrl, responsiveImage } from "./images";

const photo: DeliveredImage = {
  id: "8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09",
  url: "http://localhost:4000/media/8d1c2b3a-0f9e-4d8c-b7a6-5e4d3c2b1a09/file?v=3a9f0c1d2e4b",
  alt: "Two chefs plating desserts",
  width: 1600,
  height: 1200,
  focalPoint: { x: 0.7, y: 0.3 },
};

describe("imageUrl", () => {
  it("asks Lintel for a crop around the focal point, keeping the version", () => {
    const url = new URL(imageUrl(photo, { width: 800, height: 450 }));

    expect(url.pathname).toBe(`/media/${photo.id}/file`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      v: "3a9f0c1d2e4b",
      w: "800",
      h: "450",
      fit: "cover",
      format: "webp",
    });
  });

  it("keeps the image's shape when there's no height", () => {
    const url = new URL(imageUrl(photo, { width: 640, format: "jpeg" }));

    expect(url.searchParams.has("h")).toBe(false);
    expect(url.searchParams.has("fit")).toBe(false);
    expect(url.searchParams.get("format")).toBe("jpeg");
  });

  it("stays within the sizes Lintel makes", () => {
    const url = new URL(imageUrl(photo, { width: 9000, height: 0.2 }));

    expect(url.searchParams.get("w")).toBe("4000");
    expect(url.searchParams.get("h")).toBe("1");
  });
});

describe("responsiveImage", () => {
  it("offers widths up to the original's, each cropped to the same shape", () => {
    const image = responsiveImage(photo, { aspectRatio: 16 / 9 });

    expect(image.srcSet.split(", ").map((candidate) => candidate.split(" ")[1])).toEqual([
      "480w",
      "768w",
      "1080w",
      "1440w",
    ]);
    expect(image.srcSet).toContain("w=1440&h=810");
    expect(image).toMatchObject({ width: 1440, height: 810 });
    expect(image.src).toContain("w=1440");
  });

  it("uses the image's own shape without an aspect ratio", () => {
    const image = responsiveImage(photo, { widths: [400, 800] });

    expect(image).toMatchObject({ width: 800, height: 600 });
    expect(image.src).not.toContain("h=");
  });

  it("still offers one size for a small image", () => {
    const icon = { ...photo, width: 120, height: 120 };

    expect(responsiveImage(icon, { aspectRatio: 1 }).srcSet).toContain("w=120&h=120");
  });
});
