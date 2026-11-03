/** Waits for a picture to finish loading. */
export function loaded(image: HTMLImageElement): Promise<HTMLImageElement> {
  return image.complete && image.naturalWidth
    ? Promise.resolve(image)
    : new Promise((resolve, reject) => {
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", reject, { once: true });
      });
}
