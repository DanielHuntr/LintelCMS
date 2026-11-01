/** Names for the places people link to most, so the footer says "Instagram", not a URL. */
const knownNames: Record<string, string> = {
  "x.com": "X",
  "twitter.com": "X",
  "linkedin.com": "LinkedIn",
  "youtube.com": "YouTube",
  "tiktok.com": "TikTok",
  "github.com": "GitHub",
};

/** "https://www.instagram.com/cornerbakery" becomes "Instagram". */
export function socialLinkName(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
  const known = knownNames[hostname];
  if (known) {
    return known;
  }
  const name = hostname.split(".")[0] ?? hostname;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
