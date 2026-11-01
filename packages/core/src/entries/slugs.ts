/**
 * Slugs are the part of an address that names an entry: "/blog/cafe-au-lait". They are
 * made from the title when an editor doesn't type one, and kept to lowercase ASCII
 * letters, numbers and hyphens, so they look the same in every browser and log.
 */

export const MAX_SLUG_LENGTH = 80;

/** Letters that don't break down into a plain letter plus an accent. */
const transliterations: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
  ı: "i",
  "&": " and ",
};

/** "Café au lait & croissants!" -> "cafe-au-lait-and-croissants". Can return "". */
export function slugify(text: string): string {
  const lowercase = text.toLowerCase();
  const transliterated = [...lowercase].map(
    (character) => transliterations[character] ?? character,
  );

  return (
    transliterated
      .join("")
      // "é" becomes "e" plus a combining accent, which is then dropped.
      .normalize("NFKD")
      .replace(/\p{Mark}/gu, "")
      // "Ana's page" reads better as "anas-page" than "ana-s-page".
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/^-+|-+$/g, "")
  );
}

/**
 * The first of `base`, `base-2`, `base-3`... that isn't in `taken`, so a second "Hello"
 * post becomes "hello-2" rather than replacing the first one's address.
 */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) {
    return base;
  }
  for (let number = 2; ; number++) {
    const candidate = `${base}-${number}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
}
