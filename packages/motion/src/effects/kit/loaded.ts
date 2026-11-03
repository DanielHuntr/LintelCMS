/** Waits for a picture to finish loading. */
export function loaded(image: HTMLImageElement): Promise<HTMLImageElement> {
  return image.complete && image.naturalWidth
    ? Promise.resolve(image)
    : new Promise((resolve, reject) => {
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener("error", reject, { once: true });
      });
}

/**
 * A picture WebGL may read. A picture from another address (the builder's canvas shows the
 * site's media from the server's) can only become a texture when it is fetched with
 * permission: this asks for a copy that way. Undefined if the server doesn't allow it.
 */
export function readableCopy(image: HTMLImageElement): Promise<HTMLImageElement | undefined> {
  const source = image.currentSrc || image.src;
  if (!source || source.startsWith("data:") || image.crossOrigin === "anonymous") {
    return Promise.resolve(undefined);
  }
  const copy = new Image();
  copy.crossOrigin = "anonymous";
  copy.src = source;
  return loaded(copy).then(
    (picture) => picture,
    () => undefined,
  );
}
