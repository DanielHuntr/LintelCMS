/** How many top-level sections a stored page design has; 0 when there is no design. */
export function countDesignSections(value: unknown): number {
  if (typeof value !== "object" || value === null || !("root" in value)) return 0;
  const root = (value as { root: { children?: unknown } }).root;
  return Array.isArray(root?.children) ? root.children.length : 0;
}

/** How many blocks a blocks field holds. */
export function countBlocks(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
