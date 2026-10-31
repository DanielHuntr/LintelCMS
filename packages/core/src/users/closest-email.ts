/**
 * Finds the email most like the one someone typed, so a command can say
 * `Did you mean ana@example.com?` instead of only "not found".
 * Returns undefined when nothing is close enough to be a likely typo.
 */
export function findClosestEmail(typed: string, emails: readonly string[]): string | undefined {
  let closest: { email: string; distance: number } | undefined;

  for (const email of emails) {
    const distance = editDistance(typed, email);
    if (!closest || distance < closest.distance) {
      closest = { email, distance };
    }
  }

  // A third of the length allows a couple of slips without suggesting unrelated people.
  const closeEnough = Math.max(2, Math.floor(typed.length / 3));
  return closest && closest.distance <= closeEnough ? closest.email : undefined;
}

/** How many single-character insertions, deletions or swaps turn `from` into `to`. */
function editDistance(from: string, to: string): number {
  let previousRow = Array.from({ length: to.length + 1 }, (_, index) => index);

  for (let fromIndex = 1; fromIndex <= from.length; fromIndex++) {
    const currentRow = [fromIndex];
    for (let toIndex = 1; toIndex <= to.length; toIndex++) {
      const substitutionCost = from[fromIndex - 1] === to[toIndex - 1] ? 0 : 1;
      currentRow[toIndex] = Math.min(
        (previousRow[toIndex] ?? 0) + 1,
        (currentRow[toIndex - 1] ?? 0) + 1,
        (previousRow[toIndex - 1] ?? 0) + substitutionCost,
      );
    }
    previousRow = currentRow;
  }

  return previousRow[to.length] ?? 0;
}
