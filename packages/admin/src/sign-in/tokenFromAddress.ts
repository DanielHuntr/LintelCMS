/**
 * The token in links Lintel emails, such as `/reset-password#token=...`. It sits after
 * "#", which browsers never send to a server, so it stays out of logs and Referer headers.
 */
export function tokenFromAddress(hash: string = window.location.hash): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");
  return token && /^[\w-]+$/.test(token) ? token : null;
}
