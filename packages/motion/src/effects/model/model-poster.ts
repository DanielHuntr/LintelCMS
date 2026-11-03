import { createModelScene } from "./model-scene.js";

/**
 * A still picture of a model as the page first shows it (the same light, background and
 * framing), for the builder to save as the model's poster: what visitors see while it
 * loads, when they ask for less motion, and on devices that can't draw 3D.
 */
export async function captureModelPoster(
  src: string,
  {
    light = "studio",
    background = "transparent",
    width = 900,
    height = 900,
  }: { light?: string; background?: string; width?: number; height?: number } = {},
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scene = await createModelScene(canvas, {
    src,
    light,
    background,
    pixelRatio: 1,
    lowPower: false,
    keepPicture: true,
  });
  try {
    scene.resize(width, height);
    scene.draw(0, 0);
    const save = (type: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    // WebP keeps a see-through background and is small; PNG where WebP can't be written.
    const webp = await save("image/webp");
    const picture = webp?.type === "image/webp" ? webp : await save("image/png");
    if (!picture) throw new Error("The model's picture couldn't be saved.");
    return picture;
  } finally {
    scene.destroy();
  }
}
