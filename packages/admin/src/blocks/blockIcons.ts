/** The icons a block can have in Insert: names from the site's icon set. */
export const blockIconNames = [
  "square",
  "users",
  "star",
  "heart",
  "megaphone",
  "briefcase",
  "calendar",
  "camera",
  "gift",
  "award",
  "sparkles",
  "lightbulb",
  "mail",
  "map-pin",
  "message-square-quote",
  "shopping-bag",
] as const;

/** The choices for the icon select, keeping one a file or plugin set that isn't in the list. */
export function blockIconChoices(current: string): Array<{ value: string; label: string }> {
  const names: string[] = [...blockIconNames];
  if (!names.includes(current)) names.unshift(current);
  return names.map((name) => ({ value: name, label: words(name) }));
}

/** Icon names are in English, as the icon set has them: "map-pin" reads "Map pin". */
function words(name: string): string {
  const spaced = name.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
