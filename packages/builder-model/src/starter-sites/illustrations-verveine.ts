/**
 * The Verveine starter site's pictures: fine sage line work on ivory, like the drawings on
 * a letterpress invitation. Portrait frames (4:5) for the gallery, landscape for the rest;
 * people replace them with photographs of their own celebrations.
 */

const ivory = "#f1ebdf";
const linen = "#e6dccb";
const sage = "#5d6b4a";
const leaf = "#a9b48f";
const ink = "#2b2620";
const dusk = "#24261f";

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

const line = (colour: string, width = 2.5, fill = "none") =>
  `fill="${fill}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

/** Pairs of olive leaves along a stem, from (x, y) upwards. */
function oliveSprig(x: number, y: number, length: number, colour = sage): string {
  let leaves = "";
  for (let step = 30; step < length; step += 34) {
    leaves += `<ellipse cx="${x - 16}" cy="${y - step}" rx="18" ry="6" fill="${colour}" transform="rotate(-30 ${x - 16} ${y - step})"/>`;
    leaves += `<ellipse cx="${x + 16}" cy="${y - step - 14}" rx="18" ry="6" fill="${colour}" transform="rotate(30 ${x + 16} ${y - step - 14})"/>`;
  }
  return `<path d="M${x} ${y}V${y - length}" ${line(colour, 2)}/>${leaves}`;
}

/** A string of small lights hanging between two points. */
function lights(from: number, to: number, y: number, sag: number): string {
  const mid = (from + to) / 2;
  let bulbs = "";
  for (let index = 1; index < 8; index += 1) {
    const t = index / 8;
    const x = from + (to - from) * t;
    const dy = 4 * sag * t * (1 - t);
    bulbs += `<circle cx="${x}" cy="${y + dy + 6}" r="4" fill="#e9d9a8"/>`;
  }
  return `<path d="M${from} ${y}Q${mid} ${y + sag * 2} ${to} ${y}" ${line(linen, 1.5)}/>${bulbs}`;
}

export const verveineIllustrations: Record<string, string> = {
  // A long table under strung lights between olive trees, at dusk.
  "verveine-cover": landscape(
    dusk,
    `${lights(60, 540, 90, 50)}<path d="M60 380V160M540 380V160" ${line(leaf, 3)}/><circle cx="60" cy="140" r="46" fill="${sage}"/><circle cx="540" cy="140" r="46" fill="${sage}"/><path d="M120 300H480" ${line(linen, 5)}/><path d="M150 300V380M450 300V380" ${line(linen, 3)}/><path d="M180 300v-26M240 300v-30M300 300v-26M360 300v-30M420 300v-26" ${line("#e9d9a8", 3)}/><path d="M0 380H600" ${line(leaf, 1.5)} opacity="0.5"/>`,
  ),
  // A farmhouse in the hills, cypresses either side.
  "verveine-mas": landscape(
    ivory,
    `<path d="M0 330c120-50 220-40 300-10s200 20 300-20V450H0Z" fill="${linen}"/><path d="M200 330V230L300 190L400 230V330Z" ${line(ink, 2.5, ivory)}/><path d="M190 234L300 188L410 234" ${line(ink, 3)}/><path d="M285 330v-46h30v46" ${line(ink)}/><rect x="225" y="255" width="26" height="32" ${line(ink, 2)}/><rect x="349" y="255" width="26" height="32" ${line(ink, 2)}/><path d="M140 330c-14-60-10-140 10-190c20 50 24 130 10 190Z" fill="${sage}"/><path d="M450 330c-14-50-10-120 8-160c18 40 22 110 8 160Z" fill="${sage}"/><path d="M490 330c-10-40-8-90 6-120c14 30 16 80 6 120Z" fill="${leaf}"/><circle cx="470" cy="90" r="26" ${line(sage, 2)}/>`,
  ),
  // A place setting from above: plate, napkin, glasses and a sprig.
  "verveine-table": portrait(
    linen,
    `<rect x="40" y="0" width="400" height="600" fill="${ivory}"/><circle cx="240" cy="320" r="120" ${line(ink, 2)}/><circle cx="240" cy="320" r="92" ${line(ink, 1.2)}/><path d="M200 300l80 40M200 340l80-40" ${line(leaf, 4)}/><path d="M80 210v220M70 210v50a10 10 0 0 0 20 0v-50M400 210v220" ${line(ink, 2.5)}/><circle cx="350" cy="160" r="30" ${line(ink, 2)}/><circle cx="290" cy="140" r="24" ${line(ink, 2)}/>${oliveSprig(150, 190, 120)}`,
  ),
  // An arch of greenery for the ceremony.
  "verveine-arch": portrait(
    ivory,
    `<path d="M110 540V260a130 130 0 0 1 260 0V540" ${line(ink, 3)}/><path d="M110 300c-20-20 0-50-10-80M130 200c10-40 50-50 60-80M250 130c30 0 60 20 70 50M350 220c20 20 30 50 20 80" ${line(sage, 3)}/><ellipse cx="120" cy="250" rx="22" ry="8" fill="${sage}" transform="rotate(-60 120 250)"/><ellipse cx="160" cy="160" rx="22" ry="8" fill="${leaf}" transform="rotate(-30 160 160)"/><ellipse cx="220" cy="135" rx="22" ry="8" fill="${sage}" transform="rotate(-10 220 135)"/><ellipse cx="300" cy="150" rx="22" ry="8" fill="${leaf}" transform="rotate(25 300 150)"/><ellipse cx="350" cy="210" rx="22" ry="8" fill="${sage}" transform="rotate(55 350 210)"/><ellipse cx="368" cy="280" rx="22" ry="8" fill="${leaf}" transform="rotate(80 368 280)"/><circle cx="190" cy="148" r="9" ${line(ink, 1.5, ivory)}/><circle cx="335" cy="180" r="9" ${line(ink, 1.5, ivory)}/><path d="M60 540H420" ${line(ink, 2)}/><path d="M180 540v-60h120v60" ${line(ink, 1.5)} opacity="0.6"/>`,
  ),
  // A three-tier cake with a sprig on top.
  "verveine-cake": portrait(
    linen,
    `<rect x="120" y="400" width="240" height="90" ${line(ink, 2.5, ivory)}/><rect x="155" y="320" width="170" height="80" ${line(ink, 2.5, ivory)}/><rect x="190" y="250" width="100" height="70" ${line(ink, 2.5, ivory)}/><path d="M120 430c40 14 80-14 120 0s80 14 120 0M155 348c30 12 55-12 85 0s55 12 85 0" ${line(sage, 2)}/><path d="M90 490h300" ${line(ink, 3)}/><path d="M150 490l-20 50M330 490l20 50" ${line(ink, 2)}/>${oliveSprig(240, 250, 110)}`,
  ),
  // Lanterns hanging from a branch.
  "verveine-lanterns": portrait(
    dusk,
    `<path d="M0 90c120 30 300 10 480 40" ${line(leaf, 4)}/><path d="M120 100v80M260 104v120M380 120v60" ${line(linen, 1.5)}/><path d="M100 180h40l8 60h-56Z" fill="#e9d9a8"/><path d="M240 224h40l8 70h-56Z" fill="#e9d9a8"/><path d="M360 180h40l8 56h-56Z" fill="#e9d9a8"/><path d="M92 240h56M232 294h56M352 236h56" ${line(linen, 3)}/><ellipse cx="80" cy="96" rx="24" ry="8" fill="${sage}" transform="rotate(15 80 96)"/><ellipse cx="320" cy="106" rx="24" ry="8" fill="${sage}" transform="rotate(-10 320 106)"/><path d="M0 520H480" ${line(leaf, 1.5)} opacity="0.4"/>`,
  ),
  // Two chairs, ribbons tied to their backs.
  "verveine-chairs": portrait(
    ivory,
    `<path d="M110 520V300h100v220M110 400h100M210 300l-10-120h-80l-10 120M310 520V300h100v220M310 400h100M410 300l-10-120h-80l-10 120" ${line(ink, 3)}/><path d="M160 230c-20 40-30 80-20 110M160 230c20 40 30 80 20 110M360 230c-20 40-30 80-20 110M360 230c20 40 30 80 20 110" ${line(sage, 3)}/><circle cx="160" cy="226" r="8" fill="${sage}"/><circle cx="360" cy="226" r="8" fill="${sage}"/><path d="M60 520H460" ${line(ink, 2)}/>`,
  ),
};
