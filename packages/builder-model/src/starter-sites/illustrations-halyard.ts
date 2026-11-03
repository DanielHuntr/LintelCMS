/**
 * The Halyard starter site's pictures: hard-edged shapes in charcoal and chalk with one
 * lime, like the markings on a gym floor. People replace them with photos of their classes.
 */

const chalk = "#e7e6e0";
const charcoal = "#17191a";
const steel = "#2a2d2e";
const lime = "#c8f04a";
const grey = "#8a8d88";

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

/** A figure drawn as a head and thick limbs, from a list of joints. */
function figure(head: [number, number], limbs: string, colour: string): string {
  return `<circle cx="${head[0]}" cy="${head[1]}" r="26" fill="${colour}"/><path d="${limbs}" fill="none" stroke="${colour}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export const halyardIllustrations: Record<string, string> = {
  // A kettlebell against a lime disc: the template card.
  "halyard-cover": landscape(
    charcoal,
    `<circle cx="300" cy="225" r="170" fill="${lime}"/><path d="M250 190a50 50 0 0 1 100 0" fill="none" stroke="${charcoal}" stroke-width="26"/><path d="M220 230a80 80 0 0 1 160 0v60a30 30 0 0 1-30 30H250a30 30 0 0 1-30-30Z" fill="${charcoal}"/><text x="300" y="285" font-family="Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="${lime}">16</text>`,
  ),
  // The studio floor from above: mats in rows and the light from the big windows.
  "halyard-room": landscape(
    chalk,
    `<path d="M0 0H600V120L420 450H0Z" fill="#f2f1ec"/><rect x="70" y="150" width="70" height="200" rx="6" fill="${charcoal}"/><rect x="180" y="150" width="70" height="200" rx="6" fill="${charcoal}"/><rect x="290" y="150" width="70" height="200" rx="6" fill="${lime}"/><rect x="400" y="150" width="70" height="200" rx="6" fill="${charcoal}"/><rect x="80" y="160" width="50" height="20" rx="4" fill="${grey}"/><rect x="190" y="160" width="50" height="20" rx="4" fill="${grey}"/><rect x="300" y="160" width="50" height="20" rx="4" fill="${charcoal}"/><rect x="410" y="160" width="50" height="20" rx="4" fill="${grey}"/><path d="M30 400H570" stroke="${charcoal}" stroke-width="4"/>`,
  ),
  // Someone holding warrior two on a lime mat.
  "halyard-yoga": portrait(
    chalk,
    `<rect x="40" y="500" width="400" height="22" rx="4" fill="${lime}"/>${figure([240, 210], "M240 250V360M90 270H390M240 360L140 500M240 360L360 440V500", charcoal)}`,
  ),
  // A kettlebell swing, at the top.
  "halyard-strength": portrait(
    steel,
    `<path d="M0 520H480" stroke="${grey}" stroke-width="4"/>${figure([220, 170], "M220 210L230 340M230 340L180 520M230 340L300 520M226 250L330 200", chalk)}<path d="M330 175a24 24 0 0 1 48 0" fill="none" stroke="${lime}" stroke-width="12"/><path d="M318 200a42 42 0 0 1 84 0v24a16 16 0 0 1-16 16h-52a16 16 0 0 1-16-16Z" fill="${lime}"/>`,
  ),
  // A rowing machine, side on.
  "halyard-rower": landscape(
    chalk,
    `<path d="M80 330H520" stroke="${charcoal}" stroke-width="14" stroke-linecap="round"/><circle cx="480" cy="290" r="50" fill="${charcoal}"/><circle cx="480" cy="290" r="24" fill="${lime}"/><rect x="200" y="300" width="80" height="22" rx="6" fill="${steel}"/><path d="M120 330v40M500 340v30" stroke="${charcoal}" stroke-width="10"/>${figure([230, 170], "M240 210L250 300M250 300L360 280L410 330M244 240L400 280", charcoal)}`,
  ),
  // Breath: concentric rings, for the slow classes.
  "halyard-breath": portrait(
    charcoal,
    `<circle cx="240" cy="300" r="200" fill="none" stroke="${steel}" stroke-width="2"/><circle cx="240" cy="300" r="150" fill="none" stroke="${grey}" stroke-width="2"/><circle cx="240" cy="300" r="100" fill="none" stroke="${chalk}" stroke-width="2"/><circle cx="240" cy="300" r="50" fill="${lime}"/>`,
  ),
};
