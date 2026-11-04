interface Edit {
  /** Where the edit starts in the original words. */
  start: number;
  /** Where it ends in the original words. */
  end: number;
  inserted: string;
}

function editBetween(original: string, changed: string): Edit {
  const longest = Math.min(original.length, changed.length);
  let start = 0;
  while (start < longest && original[start] === changed[start]) start += 1;
  let fromEnd = 0;
  while (
    fromEnd < longest - start &&
    original[original.length - 1 - fromEnd] === changed[changed.length - 1 - fromEnd]
  ) {
    fromEnd += 1;
  }
  return {
    start,
    end: original.length - fromEnd,
    inserted: changed.slice(start, changed.length - fromEnd),
  };
}

/**
 * Someone changed words from `from` to `to`, and they now read `current` because someone else
 * got there first. When the two edits are in different parts of the words, both are kept; when
 * they are in the same part, the later one (`to`) stands, as with any other value.
 */
export function mergeText(from: string, to: string, current: string): string {
  if (current === from || current === to) return to;
  if (from === to) return current;
  const mine = editBetween(from, to);
  const theirs = editBetween(from, current);
  if (mine.end <= theirs.start) {
    return (
      from.slice(0, mine.start) +
      mine.inserted +
      from.slice(mine.end, theirs.start) +
      theirs.inserted +
      from.slice(theirs.end)
    );
  }
  if (theirs.end <= mine.start) {
    return (
      from.slice(0, theirs.start) +
      theirs.inserted +
      from.slice(theirs.end, mine.start) +
      mine.inserted +
      from.slice(mine.end)
    );
  }
  return to;
}
