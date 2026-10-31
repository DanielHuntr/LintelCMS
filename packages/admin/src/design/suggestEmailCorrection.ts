/**
 * Catches slips in the part of an email address after the @, such as "gmai.com" or
 * "hotmial.com", by comparing it with the domains most people use.
 *
 * It only ever suggests: a domain that isn't on the list (a company's own, say) is left
 * alone, and people can always ignore the suggestion and carry on.
 */

/** Popular email domains, most used first, so a tie goes to the more likely one. */
const popularDomains = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "live.com",
  "msn.com",
  "me.com",
  "mac.com",
  "googlemail.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "zoho.com",
  "fastmail.com",
  "yandex.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "sbcglobal.net",
  "btinternet.com",
  "virginmedia.com",
  "sky.com",
  // Country versions, listed so that they aren't "corrected" to one another.
  "yahoo.co.uk",
  "yahoo.de",
  "yahoo.fr",
  "yahoo.ca",
  "hotmail.co.uk",
  "hotmail.de",
  "hotmail.fr",
  "hotmail.it",
  "hotmail.es",
  "outlook.co.uk",
  "outlook.de",
  "outlook.fr",
  "live.co.uk",
  "live.ca",
  "gmx.de",
  "gmx.net",
  "gmx.at",
  "web.de",
  "orange.fr",
  "free.fr",
];

/**
 * The corrected address, or null when the address looks right (or isn't close to any
 * popular domain). "Daniel@GMAI.COM " becomes "Daniel@gmail.com": the part before the @
 * is kept as typed, since some mail servers treat its letters case by case.
 */
export function suggestEmailCorrection(email: string): string | null {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf("@");
  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1).toLowerCase();

  if (atIndex < 1 || domain === "" || popularDomains.includes(domain)) {
    return null;
  }

  const correctedDomain = closestPopularDomain(domain);
  return correctedDomain ? `${localPart}@${correctedDomain}` : null;
}

function closestPopularDomain(domain: string): string | null {
  // "gmail" on its own is almost certainly "gmail.com".
  if (!domain.includes(".")) {
    return popularDomains.find((popular) => popular.startsWith(`${domain}.`)) ?? null;
  }

  // Short domains get less leeway: "live.ca" is two edits from "live.com" and is real.
  const allowedEdits = domain.length >= 10 ? 2 : 1;
  let closest: string | null = null;
  let closestDistance = allowedEdits + 1;

  for (const popular of popularDomains) {
    const distance = editDistance(domain, popular);
    if (distance < closestDistance) {
      closest = popular;
      closestDistance = distance;
    }
  }

  return closest;
}

/**
 * How many single-letter changes turn one word into the other. Swapping two neighbouring
 * letters counts as one change, because "gmial" is one slip, not two.
 */
export function editDistance(from: string, to: string): number {
  // A grid where cell (i, j) holds the distance between the first i letters of `from`
  // and the first j letters of `to`. The answer ends up in the last cell.
  const width = to.length + 1;
  const cells = new Array<number>((from.length + 1) * width).fill(0);
  const at = (i: number, j: number) => cells[i * width + j] ?? 0;

  for (let i = 0; i <= from.length; i++) {
    for (let j = 0; j <= to.length; j++) {
      if (i === 0 || j === 0) {
        cells[i * width + j] = i + j;
        continue;
      }

      const changeCost = from[i - 1] === to[j - 1] ? 0 : 1;
      const isSwap = i > 1 && j > 1 && from[i - 1] === to[j - 2] && from[i - 2] === to[j - 1];

      cells[i * width + j] = Math.min(
        at(i - 1, j) + 1, // remove a letter
        at(i, j - 1) + 1, // add a letter
        at(i - 1, j - 1) + changeCost, // change a letter
        isSwap ? at(i - 2, j - 2) + 1 : Infinity, // swap two neighbours
      );
    }
  }

  return at(from.length, to.length);
}
