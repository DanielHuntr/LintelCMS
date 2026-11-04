/**
 * Each person's colour, the same for everyone who sees them, for their initials and their
 * pointer on the canvas. These are people's colours rather than the admin's look, so they stay
 * the same under any branding, and white text reads on all of them.
 */
const personColours = [
  "#B4441C",
  "#0E7C66",
  "#2A5DB0",
  "#A1306B",
  "#6B6F1E",
  "#8A5A12",
  "#2F7D32",
  "#4A5568",
] as const;

export function personColour(personId: string): string {
  let hash = 0;
  for (const letter of personId) hash = (hash * 31 + letter.charCodeAt(0)) >>> 0;
  return personColours[hash % personColours.length] ?? personColours[0];
}
