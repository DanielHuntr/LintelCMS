/**
 * Turns a browser's user-agent string into words people recognise, such as
 * "Firefox on Windows", for the list of places someone is signed in. Only for display:
 * a user-agent is easy to fake, so nothing relies on it.
 */
const browsers: ReadonlyArray<[RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const systems: ReadonlyArray<[RegExp, string]> = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) {
    return "Unknown browser";
  }
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (browser && system) {
    return `${browser} on ${system}`;
  }
  return browser ?? system ?? "Unknown browser";
}
