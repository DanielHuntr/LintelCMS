/**
 * The pictures the section library and starter sites use: simple, flat illustrations drawn
 * here as SVG, so every site starts with artwork of its own and nothing borrowed. The
 * built-in website serves them at `/_lintel/illustrations/<name>.svg`; people replace them
 * with their own photos from the media library whenever they like.
 */

import { atelierIllustrations } from "./illustrations-atelier.js";
import { folioIllustrations } from "./illustrations-folio.js";
import { halyardIllustrations } from "./illustrations-halyard.js";
import { hollisIllustrations } from "./illustrations-hollis.js";
import { lindIllustrations } from "./illustrations-lind.js";
import { northsideIllustrations } from "./illustrations-northside.js";
import { studioIllustrations } from "./illustrations-studio.js";
import { tollboothIllustrations } from "./illustrations-tollbooth.js";
import { verveineIllustrations } from "./illustrations-verveine.js";

const frame = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

const illustrationList: Record<string, string> = {
  "abstract-hills": frame(
    "#eef0ff",
    `<circle cx="450" cy="120" r="56" fill="#ffd27a"/><path d="M0 330 Q150 210 300 300 T600 260 V450 H0Z" fill="#a9b4ff"/><path d="M0 380 Q200 290 380 360 T600 350 V450 H0Z" fill="#6c63ff"/>`,
  ),
  "abstract-window": frame(
    "#fff4ea",
    `<rect x="150" y="70" width="300" height="310" rx="150" fill="#ffd8b8"/><rect x="190" y="130" width="220" height="250" rx="110" fill="#ff9f68"/><rect x="0" y="380" width="600" height="70" fill="#f0c9a6"/><circle cx="300" cy="230" r="34" fill="#fff4ea"/>`,
  ),
  "abstract-circles": frame(
    "#e9f7f2",
    `<circle cx="210" cy="220" r="130" fill="#9be0c7"/><circle cx="360" cy="240" r="110" fill="#33b38a" opacity="0.85"/><circle cx="290" cy="150" r="60" fill="#ffffff" opacity="0.7"/>`,
  ),
  "bakery-loaf": frame(
    "#fbf1e4",
    `<ellipse cx="300" cy="360" rx="230" ry="26" fill="#ead5bb"/><path d="M110 330 C110 190 490 190 490 330 Z" fill="#d9924f"/><path d="M180 250 l40 -40 M260 230 l40 -40 M340 230 l40 -40 M410 250 l30 -30" stroke="#f6d3a4" stroke-width="16" stroke-linecap="round"/><rect x="110" y="320" width="380" height="20" rx="10" fill="#b8743a"/>`,
  ),
  "bakery-cup": frame(
    "#f3ebe3",
    `<ellipse cx="300" cy="370" rx="190" ry="30" fill="#e0d0c0"/><path d="M180 200 H420 L400 350 Q300 380 200 350 Z" fill="#ffffff"/><path d="M420 230 Q490 230 480 290 Q470 330 410 320" fill="none" stroke="#ffffff" stroke-width="22"/><ellipse cx="300" cy="205" rx="120" ry="22" fill="#7a4a2a"/><path d="M260 160 q-20 -30 0 -60 M300 150 q-20 -30 0 -60 M340 160 q-20 -30 0 -60" stroke="#c9b6a3" stroke-width="10" fill="none" stroke-linecap="round"/>`,
  ),
  "bakery-croissant": frame(
    "#fff7e6",
    `<path d="M120 300 Q300 80 480 300 Q420 330 380 300 Q300 230 220 300 Q180 330 120 300Z" fill="#e8a54b"/><path d="M220 300 Q300 200 380 300" fill="none" stroke="#c97f2c" stroke-width="12"/><path d="M260 262 L250 200 M300 250 L300 175 M340 262 L350 200" stroke="#c97f2c" stroke-width="10" stroke-linecap="round"/><ellipse cx="300" cy="350" rx="210" ry="18" fill="#f2dfbf"/>`,
  ),
  "consultant-chart": frame(
    "#eef3f8",
    `<rect x="110" y="80" width="380" height="290" rx="20" fill="#ffffff"/><rect x="160" y="260" width="50" height="70" rx="8" fill="#b7cbe0"/><rect x="235" y="220" width="50" height="110" rx="8" fill="#8fb0d1"/><rect x="310" y="170" width="50" height="160" rx="8" fill="#4f7fb0"/><rect x="385" y="120" width="50" height="210" rx="8" fill="#1f4f80"/><path d="M160 210 L260 170 L330 130 L430 100" stroke="#e0a93b" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  ),
  "consultant-desk": frame(
    "#f2f0ec",
    `<rect x="70" y="300" width="460" height="22" rx="11" fill="#5c4a3a"/><rect x="170" y="140" width="260" height="160" rx="14" fill="#1f4f80"/><rect x="190" y="160" width="220" height="120" rx="6" fill="#dce8f4"/><rect x="420" y="230" width="60" height="70" rx="10" fill="#e0a93b"/><circle cx="130" cy="250" r="40" fill="#8bb08a"/><rect x="122" y="250" width="16" height="50" fill="#5c4a3a"/>`,
  ),
  "portfolio-frame": frame(
    "#111114",
    `<rect x="120" y="70" width="360" height="310" fill="#f4f1ea"/><circle cx="250" cy="200" r="70" fill="#ff5a3c"/><rect x="290" y="180" width="130" height="150" fill="#1d1d1f"/><rect x="170" y="290" width="90" height="40" fill="#ffd400"/>`,
  ),
  "portfolio-shapes": frame(
    "#f4f1ea",
    `<rect x="90" y="90" width="190" height="270" fill="#1d1d1f"/><circle cx="400" cy="170" r="90" fill="#ff5a3c"/><path d="M320 360 L420 250 L520 360 Z" fill="#ffd400"/>`,
  ),
  "portfolio-type": frame(
    "#ffd400",
    `<text x="300" y="275" font-family="Georgia, serif" font-size="220" font-weight="700" text-anchor="middle" fill="#1d1d1f">Aa</text><rect x="120" y="320" width="360" height="12" fill="#1d1d1f"/>`,
  ),
  "magazine-leaf": frame(
    "#eef2ea",
    `<path d="M300 380 C120 330 140 120 300 70 C460 120 480 330 300 380Z" fill="#7da36f"/><path d="M300 380 V90 M300 170 L240 130 M300 230 L230 190 M300 290 L240 255 M300 170 L360 130 M300 230 L370 190 M300 290 L360 255" stroke="#eef2ea" stroke-width="8" stroke-linecap="round" fill="none"/>`,
  ),
  "magazine-pages": frame(
    "#f6f2ec",
    `<path d="M300 110 Q200 80 110 110 V360 Q200 330 300 360Z" fill="#ffffff"/><path d="M300 110 Q400 80 490 110 V360 Q400 330 300 360Z" fill="#fbfaf7"/><path d="M140 160 H270 M140 195 H260 M140 230 H270 M330 160 H460 M330 195 H450 M330 230 H460 M330 265 H420" stroke="#c9c1b4" stroke-width="10" stroke-linecap="round"/><rect x="295" y="105" width="10" height="260" fill="#d9cfc0"/>`,
  ),
  "magazine-lamp": frame(
    "#2b2a33",
    `<path d="M220 110 H380 L430 220 H170Z" fill="#f2c76e"/><path d="M170 220 L80 450 H520 L430 220Z" fill="#f2c76e" opacity="0.18"/><rect x="292" y="60" width="16" height="50" fill="#9a97a8"/><rect x="250" y="360" width="100" height="16" rx="8" fill="#9a97a8"/>`,
  ),
  "service-tools": frame(
    "#e8f1f7",
    `<rect x="140" y="270" width="320" height="110" rx="16" fill="#1f6f9f"/><rect x="250" y="240" width="100" height="40" rx="12" fill="none" stroke="#1f6f9f" stroke-width="16"/><path d="M190 120 L330 260" stroke="#f0a52a" stroke-width="26" stroke-linecap="round"/><circle cx="180" cy="110" r="34" fill="none" stroke="#f0a52a" stroke-width="20"/><rect x="140" y="310" width="320" height="12" fill="#e8f1f7" opacity="0.5"/>`,
  ),
  "service-van": frame(
    "#eaf4ef",
    `<rect x="80" y="170" width="300" height="150" rx="18" fill="#2f8f6b"/><path d="M380 210 H460 L520 270 V320 H380Z" fill="#2f8f6b"/><rect x="400" y="225" width="55" height="45" rx="6" fill="#d8efe5"/><circle cx="170" cy="330" r="38" fill="#1d1d1f"/><circle cx="440" cy="330" r="38" fill="#1d1d1f"/><circle cx="170" cy="330" r="14" fill="#d8efe5"/><circle cx="440" cy="330" r="14" fill="#d8efe5"/><rect x="110" y="205" width="160" height="22" rx="11" fill="#d8efe5"/>`,
  ),
  "service-house": frame(
    "#f7efe7",
    `<path d="M120 230 L300 90 L480 230Z" fill="#c4553b"/><rect x="160" y="230" width="280" height="160" fill="#f2d6bf"/><rect x="270" y="290" width="60" height="100" rx="6" fill="#7a3b2b"/><rect x="185" y="260" width="55" height="50" rx="6" fill="#ffffff"/><rect x="360" y="260" width="55" height="50" rx="6" fill="#ffffff"/>`,
  ),
  "product-phone": frame(
    "#f1edff",
    `<rect x="215" y="40" width="170" height="370" rx="32" fill="#1d1d1f"/><rect x="230" y="70" width="140" height="310" rx="18" fill="#7a5cff"/><rect x="250" y="110" width="100" height="18" rx="9" fill="#ffffff" opacity="0.85"/><rect x="250" y="150" width="70" height="12" rx="6" fill="#ffffff" opacity="0.6"/><circle cx="300" cy="270" r="48" fill="#ffffff" opacity="0.9"/><circle cx="430" cy="140" r="30" fill="#ffb84d"/>`,
  ),
  "product-box": frame(
    "#fff3e8",
    `<path d="M300 100 L470 180 L300 260 L130 180Z" fill="#ffb27a"/><path d="M130 180 L300 260 V390 L130 310Z" fill="#f08a4b"/><path d="M470 180 L300 260 V390 L470 310Z" fill="#d96f30"/><path d="M215 140 L385 220" stroke="#fff3e8" stroke-width="14"/>`,
  ),
  "product-waves": frame(
    "#0f1530",
    `<path d="M0 260 Q150 180 300 260 T600 260" stroke="#7a5cff" stroke-width="18" fill="none"/><path d="M0 310 Q150 230 300 310 T600 310" stroke="#4dd2ff" stroke-width="18" fill="none" opacity="0.8"/><path d="M0 360 Q150 280 300 360 T600 360" stroke="#ffb84d" stroke-width="18" fill="none" opacity="0.7"/><circle cx="460" cy="120" r="40" fill="#ffffff" opacity="0.15"/>`,
  ),
  ...folioIllustrations,
  ...atelierIllustrations,
  ...studioIllustrations,
  ...tollboothIllustrations,
  ...hollisIllustrations,
  ...verveineIllustrations,
  ...lindIllustrations,
  ...halyardIllustrations,
  ...northsideIllustrations,
};

export const illustrationNames: readonly string[] = Object.keys(illustrationList);

/** The SVG for an illustration, or undefined if there is none with that name. */
export function findIllustration(name: string): string | undefined {
  return Object.hasOwn(illustrationList, name) ? illustrationList[name] : undefined;
}
