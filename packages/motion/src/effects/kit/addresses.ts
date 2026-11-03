/** Only addresses on this site or on the web: never `javascript:`, `data:` or other schemes. */
export function safePictureAddress(address: string): string {
  const trimmed = address.trim();
  return /^https?:/i.test(trimmed) || !/^[a-z][\w+.-]*:/i.test(trimmed) ? trimmed : "";
}
