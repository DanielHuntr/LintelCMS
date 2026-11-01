import wordListText from "./eff-large-wordlist.txt?raw";

/**
 * "Suggest a password": four random words and a number, joined with hyphens, such as
 * "maple-orbit-cactus-river-42". Four words from 7,772 and a two-digit number give about
 * 58 bits of randomness: far beyond guessing, yet easy to read out and type.
 *
 * The words are the EFF's list for passphrases (see NOTICE): common, distinct, easy to spell.
 */

export const passphraseWordCount = 4;

/** Anything that fills an array with random numbers: `crypto` in browsers and in Node, or a test's fake. */
export interface RandomSource {
  getRandomValues(values: Uint32Array<ArrayBuffer>): Uint32Array<ArrayBuffer>;
}

export const effWordList: readonly string[] = wordListText.split("\n").filter(Boolean);

/**
 * A uniformly random whole number from 0 up to (not including) `limit`.
 *
 * `random % limit` would favour small numbers whenever 2^32 isn't a multiple of `limit`.
 * Instead, values from the incomplete last block of 2^32 are thrown away and drawn again,
 * so every result is equally likely. At most about one draw in a million is wasted for
 * the limits used here.
 */
export function randomIndexBelow(limit: number, random: RandomSource = crypto): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 2 ** 32) {
    throw new RangeError(`The limit must be a whole number from 1 to 2^32, not ${limit}.`);
  }
  const range = 2 ** 32;
  const largestFairValue = range - (range % limit);
  const draw = new Uint32Array(1);
  for (;;) {
    const value = random.getRandomValues(draw)[0] ?? 0;
    if (value < largestFairValue) return value % limit;
  }
}

export function generatePassphrase(
  words: readonly string[] = effWordList,
  random: RandomSource = crypto,
): string {
  const chosen = Array.from(
    { length: passphraseWordCount },
    () => words[randomIndexBelow(words.length, random)],
  );
  // 10 to 99, so the number always has two digits and the passphrase a predictable shape.
  const number = 10 + randomIndexBelow(90, random);
  return [...chosen, String(number)].join("-");
}
