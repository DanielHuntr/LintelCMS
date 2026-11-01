/** The list with the item at `index` swapped with its neighbour; unchanged at either end. */
export function movedItem<Item>(items: readonly Item[], index: number, offset: -1 | 1): Item[] {
  const target = index + offset;
  const next = [...items];
  const moving = next[index];
  const neighbour = next[target];
  if (moving === undefined || neighbour === undefined) return next;
  next[target] = moving;
  next[index] = neighbour;
  return next;
}
