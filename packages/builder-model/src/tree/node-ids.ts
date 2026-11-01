/** Makes the id of a new node. Passed in wherever nodes are made, so tests can use known ids. */
export type CreateNodeId = () => string;

const idAlphabet = "abcdefghijkmnpqrstuvwxyz23456789";

interface RandomSource {
  getRandomValues<Values extends Uint8Array>(values: Values): Values;
}

/**
 * Ten random letters and digits (no look-alikes such as l and 1): short enough to read in the
 * code view, and with 32^10 possibilities two nodes on one page never share one.
 */
export const createRandomNodeId: CreateNodeId = () => {
  const random = (globalThis as unknown as { crypto: RandomSource }).crypto;
  const bytes = random.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => idAlphabet[byte % idAlphabet.length]).join("");
};

/** Ids "n1", "n2"... in order, for tests and snapshots. */
export function createCountingNodeIds(prefix = "n"): CreateNodeId {
  let count = 0;
  return () => {
    count += 1;
    return `${prefix}${count}`;
  };
}
