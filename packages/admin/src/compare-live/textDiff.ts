/** One run of words: in both versions, only in the new one, or only in the live one. */
export interface DiffPart {
  kind: "same" | "added" | "removed";
  text: string;
}

/**
 * Past this many word pairs, comparing word by word would take too long in the browser,
 * so a very long text that changed is shown as all removed, then all added.
 */
const MAX_COMPARISONS = 2_000_000;

/**
 * The words that changed between two texts, in reading order. Words and the spaces between
 * them are compared as they are, so "Open 9 to 5" → "Open 8 to 6" marks only the two times.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ kind: "same", text: before }] : [];
  const old = tokenise(before);
  const next = tokenise(after);
  if (old.length * next.length > MAX_COMPARISONS) {
    return joinRuns([
      { kind: "removed", text: before },
      { kind: "added", text: after },
    ]);
  }
  return joinRuns(walkCommonWords(old, next));
}

function tokenise(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

/**
 * The classic longest-common-subsequence table, read back from the start: words in both
 * stay, the rest are removed (from the live text) or added (in the new one).
 */
function walkCommonWords(old: string[], next: string[]): DiffPart[] {
  const columns = next.length + 1;
  const lengths = new Uint32Array((old.length + 1) * columns);
  for (let row = old.length - 1; row >= 0; row -= 1) {
    for (let column = next.length - 1; column >= 0; column -= 1) {
      lengths[row * columns + column] =
        old[row] === next[column]
          ? (lengths[(row + 1) * columns + column + 1] ?? 0) + 1
          : Math.max(
              lengths[(row + 1) * columns + column] ?? 0,
              lengths[row * columns + column + 1] ?? 0,
            );
    }
  }

  const parts: DiffPart[] = [];
  let row = 0;
  let column = 0;
  while (row < old.length && column < next.length) {
    if (old[row] === next[column]) {
      parts.push({ kind: "same", text: old[row] ?? "" });
      row += 1;
      column += 1;
    } else if (
      (lengths[(row + 1) * columns + column] ?? 0) >= (lengths[row * columns + column + 1] ?? 0)
    ) {
      parts.push({ kind: "removed", text: old[row] ?? "" });
      row += 1;
    } else {
      parts.push({ kind: "added", text: next[column] ?? "" });
      column += 1;
    }
  }
  for (; row < old.length; row += 1) parts.push({ kind: "removed", text: old[row] ?? "" });
  for (; column < next.length; column += 1) parts.push({ kind: "added", text: next[column] ?? "" });
  return parts;
}

/**
 * Neighbouring parts of the same kind become one, and a lone space between two changes
 * joins them, so "Open 9 to 5" → "Closed on Sundays" reads as one removal and one addition
 * rather than a word-by-word patchwork.
 */
function joinRuns(parts: DiffPart[]): DiffPart[] {
  const tidied: DiffPart[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (!part || part.text === "") continue;
    const previous = parts[index - 1];
    const following = parts[index + 1];
    const isSpaceBetweenChanges =
      part.kind === "same" &&
      /^\s+$/.test(part.text) &&
      previous !== undefined &&
      following !== undefined &&
      previous.kind !== "same" &&
      following.kind !== "same";
    if (isSpaceBetweenChanges) {
      tidied.push({ kind: "removed", text: part.text }, { kind: "added", text: part.text });
      continue;
    }
    tidied.push(part);
  }
  return mergeNeighbours(groupChanges(tidied));
}

/** Within a stretch of changes, removals come first and then additions. */
function groupChanges(parts: DiffPart[]): DiffPart[] {
  const grouped: DiffPart[] = [];
  let removed = "";
  let added = "";
  const flush = () => {
    if (removed) grouped.push({ kind: "removed", text: removed });
    if (added) grouped.push({ kind: "added", text: added });
    removed = "";
    added = "";
  };
  for (const part of parts) {
    if (part.kind === "removed") removed += part.text;
    else if (part.kind === "added") added += part.text;
    else {
      flush();
      grouped.push(part);
    }
  }
  flush();
  return grouped;
}

function mergeNeighbours(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (last && last.kind === part.kind) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}
