/**
 * Turns what someone typed into search terms. Only letters and numbers survive, so the
 * words are always safe to hand to Postgres full-text search, and each one matches as a
 * prefix, which is what people expect from a search box that updates as they type:
 * "abo us" finds "About us".
 */

/** More words than this rarely narrows anything down, and keeps the query cheap. */
const MAX_WORDS = 8;

export function searchWords(query: string): string[] {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words)].slice(0, MAX_WORDS);
}

/** A `to_tsquery` expression where every word must match the start of a word. */
export function prefixTsQuery(words: readonly string[]): string {
  return words.map((word) => `${word}:*`).join(" & ");
}

/** So a search for "100%" looks for those characters rather than "anything". */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
