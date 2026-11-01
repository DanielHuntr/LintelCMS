/**
 * The curated font pairings a site can choose from. Each uses fonts already on visitors'
 * devices (system font stacks), so pages show their real text straight away: nothing to
 * download, no flash of a fallback font and no layout shift, and no third-party font
 * service learning who visits.
 */

export interface FontPairing {
  id: string;
  name: string;
  /** One plain sentence for the picker in Settings, Site. */
  description: string;
  headingFont: string;
  bodyFont: string;
}

const systemSans =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const transitionalSerif =
  'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, "Times New Roman", serif';
const oldStyleSerif =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "URW Palladio L", P052, Georgia, serif';
const geometricSans =
  'Avenir, "Avenir Next LT Pro", Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif';
const roundedSans =
  'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif';

export const fontPairings = [
  {
    id: "system",
    name: "Clean",
    description: "Your device’s own font throughout: crisp and familiar.",
    headingFont: systemSans,
    bodyFont: systemSans,
  },
  {
    id: "classic",
    name: "Classic",
    description: "Elegant serif headings with clean, easy-reading text.",
    headingFont: oldStyleSerif,
    bodyFont: systemSans,
  },
  {
    id: "editorial",
    name: "Editorial",
    description: "Serif throughout, like a well-made magazine. Lovely for long reads.",
    headingFont: oldStyleSerif,
    bodyFont: transitionalSerif,
  },
  {
    id: "geometric",
    name: "Geometric",
    description: "Modern, rounded letter shapes for headings, with clean text.",
    headingFont: geometricSans,
    bodyFont: systemSans,
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Soft, rounded headings for a warm and approachable feel.",
    headingFont: roundedSans,
    bodyFont: systemSans,
  },
] as const satisfies readonly FontPairing[];

export type FontPairingId = (typeof fontPairings)[number]["id"];

export const fontPairingIds = fontPairings.map((pairing) => pairing.id) as [
  FontPairingId,
  ...FontPairingId[],
];

export function findFontPairing(id: string): FontPairing {
  return fontPairings.find((pairing) => pairing.id === id) ?? fontPairings[0];
}
