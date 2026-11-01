/**
 * Handles are the names templates and the API use for fields and content types:
 * lowercase letters, numbers and underscores, starting with a letter ("hero_image").
 * People type labels; handles are made from them until someone edits one by hand.
 */

const maximumHandleLength = 48;

export function handleFromLabel(label: string, prefixForDigits = "field"): string {
  const handle = label
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, maximumHandleLength)
    .replace(/_+$/, "");

  if (handle === "") return "";
  // A handle must start with a letter, so "3D model" becomes "field_3d_model".
  return /^[a-z]/.test(handle) ? handle : `${prefixForDigits}_${handle}`;
}

/** What someone may type into a handle box: invalid characters become underscores as they type. */
export function cleanTypedHandle(typed: string): string {
  return typed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, maximumHandleLength);
}

export function isValidHandle(handle: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(handle);
}

/** `base`, or `base_2`, `base_3`... whichever is free. */
export function uniqueHandle(base: string, taken: Iterable<string>): string {
  const takenHandles = new Set(taken);
  if (!takenHandles.has(base)) return base;
  let suffix = 2;
  while (takenHandles.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}
