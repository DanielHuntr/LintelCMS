/**
 * Where words start in a piece of text, the way Postgres's full-text search with the "simple"
 * configuration splits it, for databases that can't. It stands in for that parser, so it
 * follows what it does rather than what might read better:
 *
 * - "support-port" is three words, so "port" finds it. "well_known" is two.
 * - An address is one word, so "example" finds "example.com", and "com" doesn't. The same goes
 *   for an email address, "file.txt", "a/b", "3.14" and "1.2.3".
 * - A number after a dash or a plus sign is signed, so "11" doesn't find "2026-11-04".
 * - HTML tags and entities aren't words.
 *
 * `word-starts.dialects.test.ts` holds it to the same answers as Postgres.
 */

const TAGS_AND_ENTITIES = /<\/?[a-z][^<>]*>|&[a-z0-9#]+;/g;

/** A word's letters and numbers, with any accents written as separate characters. */
const WORD = String.raw`[\p{L}\p{N}\p{M}]+`;
const ADDRESS_PART = String.raw`[a-z0-9]+(?:-[a-z0-9]+)*`;

const TOKENS = new RegExp(
  [
    // An email address: one word.
    String.raw`[\p{L}\p{N}._+-]+@${ADDRESS_PART}(?:\.${ADDRESS_PART})+`,
    // An address, file or version, after any protocol: one word.
    String.raw`(?:[a-z][a-z0-9+.-]*:\/\/)?${ADDRESS_PART}(?:[.\/]${ADDRESS_PART})+`,
    // A signed number, which can never be found: searches have no sign.
    String.raw`[-+]\p{N}+(?![\p{L}\p{M}])`,
    WORD,
  ].join("|"),
  "gu",
);

function lowerCase(text: string): string {
  // "İ" becomes "i" and a dot in JavaScript. Postgres leaves out the dot, so words still match.
  return text.toLowerCase().normalize("NFC").replaceAll("i̇", "i");
}

/** What each word in the text starts with. Whatever can't be found isn't listed. */
export function wordStartsIn(text: string): string[] {
  const words = lowerCase(text).replace(TAGS_AND_ENTITIES, " ").match(TOKENS) ?? [];
  return words
    .filter((word) => !/^[-+]/.test(word))
    .map((word) => word.replace(/^[a-z][a-z0-9+.-]*:\/\//, ""));
}

/** Every text value in a JSON value, inside objects and lists, and never a key. */
function textValuesIn(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(textValuesIn);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(textValuesIn);
  }
  return [];
}

export interface WordDocument {
  title: string;
  /** With words joined by hyphens. */
  slug: string;
  /** A JSON value, whose text values are searched. */
  values: unknown;
}

/** Whether every search word starts a word somewhere in the document. */
export function documentHasWords(document: WordDocument, searchWords: readonly string[]): boolean {
  const found = [
    document.title,
    document.slug.replaceAll("-", " "),
    ...textValuesIn(document.values),
  ].flatMap(wordStartsIn);
  return searchWords.every((word) => found.some((start) => start.startsWith(word)));
}
