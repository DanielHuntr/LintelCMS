/**
 * The Studio starter site's drawings: architectural line work in ink on paper (and paper on
 * ink), with one warm accent, as an architect's elevations, plans and sections would be.
 * Drawn here as SVG like the other illustrations, and served the same way.
 */

const paper = "#ebe8e2";
const ink = "#1a1a1a";
const night = "#161616";
const light = "#e9e5dc";
const accent = "#c8441f";
const faint = "#cfc9be";

const drawing = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

/** Short slanted strokes under a ground line, as sections show cut earth. */
function hatch(from: number, to: number, y: number, colour = ink): string {
  let path = "";
  for (let x = from; x <= to; x += 14) path += `M${x} ${y}l-9 12`;
  return `<path d="${path}" stroke="${colour}" stroke-width="1.2"/>`;
}

/** Evenly spaced lines between two points, moved by a step each time. */
function lines(
  count: number,
  start: [number, number, number, number],
  step: [number, number],
  colour: string,
  width = 1.2,
): string {
  let path = "";
  for (let index = 0; index < count; index += 1) {
    const [x1, y1, x2, y2] = start;
    const dx = step[0] * index;
    const dy = step[1] * index;
    path += `M${x1 + dx} ${y1 + dy}L${x2 + dx} ${y2 + dy}`;
  }
  return `<path d="${path}" stroke="${colour}" stroke-width="${width}"/>`;
}

const stroke = (colour: string, width = 2) =>
  `fill="none" stroke="${colour}" stroke-width="${width}" stroke-linejoin="round"`;

export const studioIllustrations: Record<string, string> = {
  // A long, low house under a single sloping roof, with a courtyard wall and a low sun.
  "studio-house": drawing(
    paper,
    `<circle cx="468" cy="118" r="34" fill="${accent}"/>` +
      `<path d="M40 330H560" ${stroke(ink)}/>` +
      hatch(46, 556, 332) +
      `<path d="M120 330V250L470 222V330" fill="${paper}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<rect x="160" y="272" width="140" height="28" fill="${ink}"/>` +
      `<rect x="380" y="268" width="24" height="62" fill="${ink}"/>` +
      `<path d="M470 300H540V330" ${stroke(ink)}/>` +
      `<path d="M90 330V300M76 312L90 296L104 312" ${stroke(ink, 1.5)}/>`,
  ),
  // The plan of public baths: a long pool, a round plunge pool with steps, and cabins.
  "studio-baths": drawing(
    paper,
    `<rect x="90" y="70" width="420" height="310" ${stroke(ink)}/>` +
      `<rect x="130" y="110" width="200" height="230" fill="${ink}"/>` +
      lines(9, [146, 134, 314, 134], [0, 23], paper, 1) +
      `<circle cx="420" cy="170" r="56" ${stroke(ink)}/>` +
      `<circle cx="420" cy="170" r="40" ${stroke(ink, 1.2)}/>` +
      `<circle cx="420" cy="170" r="24" fill="${accent}"/>` +
      `<path d="M360 260H480V340H360Z" ${stroke(ink, 1.5)}/>` +
      lines(5, [384, 260, 384, 340], [24, 0], ink, 1.2) +
      `<path d="M540 110V70M532 84L540 70L548 84" ${stroke(ink, 1.5)}/>`,
  ),
  // A long table drawn in axonometric, with a bowl on it.
  "studio-table": drawing(
    paper,
    lines(6, [70, 400, 530, 400], [0, 8], faint, 1) +
      `<path d="M130 232V330M210 278V372M480 186V286" ${stroke(ink)}/>` +
      `<path d="M110 220L390 120L500 170L220 270Z" fill="${paper}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M110 220V232L220 282L500 182V170" ${stroke(ink)}/>` +
      `<ellipse cx="330" cy="190" rx="34" ry="13" fill="${accent}"/>` +
      `<path d="M150 250V320" ${stroke(ink, 1)}/>`,
  ),
  // A section through a vaulted reading room: tall arched windows, a long table, shelves.
  "studio-library": drawing(
    paper,
    `<path d="M80 380V120Q300 20 520 120V380Z" ${stroke(ink)}/>` +
      [190, 300, 410]
        .map(
          (x) =>
            `<path d="M${x - 30} 300V190A30 30 0 0 1 ${x + 30} 190V300Z" fill="${ink}" opacity="0.9"/>`,
        )
        .join("") +
      `<path d="M80 310H520" ${stroke(ink, 1.5)}/>` +
      lines(54, [96, 322, 96, 372], [7.6, 0], ink, 1.4) +
      `<path d="M150 344H450" stroke="${paper}" stroke-width="8"/>` +
      `<circle cx="300" cy="340" r="7" fill="${accent}"/>` +
      `<path d="M40 380H560" ${stroke(ink)}/>` +
      hatch(46, 556, 382),
  ),
  // A pavilion of thin columns under a flat roof, at a quarry's edge, drawn light on dark.
  "studio-pavilion": drawing(
    night,
    `<circle cx="470" cy="92" r="22" fill="${accent}"/>` +
      lines(7, [40, 392, 560, 392], [0, 9], "#3a3833", 1.2) +
      `<path d="M90 330L200 380L530 335" ${stroke("#6d6960", 1.5)}/>` +
      `<path d="M90 150V330M200 205V380M530 160V335M282 194V369M365 183V358M448 171V346M145 177V355" ${stroke(light, 1.6)}/>` +
      `<path d="M90 150L420 110L530 160L200 205Z" fill="${night}" stroke="${light}" stroke-width="2" stroke-linejoin="round"/>` +
      `<path d="M90 150V158L200 213L530 168V160" ${stroke(light, 1.6)}/>`,
  ),
  // A tall granary with a grid of small openings, one of them lit.
  "studio-granary": drawing(
    paper,
    `<path d="M40 380H560" ${stroke(ink)}/>` +
      hatch(46, 556, 382) +
      `<path d="M180 380V170L300 70L420 170V380" fill="${paper}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
      [0, 1, 2, 3]
        .flatMap((row) =>
          [0, 1, 2].map((column) => {
            const lit = row === 1 && column === 2;
            return `<rect x="${218 + column * 64}" y="${190 + row * 44}" width="36" height="22" fill="${lit ? accent : ink}"/>`;
          }),
        )
        .join("") +
      `<rect x="282" y="340" width="36" height="40" fill="${ink}"/>` +
      `<circle cx="300" cy="128" r="12" ${stroke(ink, 1.5)}/>`,
  ),
  // A site plan: contour lines on a slope, a building's footprint and the way in.
  "studio-site-plan": drawing(
    paper,
    [50, 85, 120, 155, 190, 225, 260, 295]
      .map(
        (r, index) =>
          `<ellipse cx="${300 + index * 6}" cy="${230 - index * 4}" rx="${r}" ry="${r * 0.62}" transform="rotate(-14 300 225)" ${stroke(index % 4 === 3 ? ink : "#a9a297", 1.2)}/>`,
      )
      .join("") +
      `<rect x="250" y="190" width="110" height="46" transform="rotate(-14 305 213)" fill="${ink}"/>` +
      `<path d="M120 400Q200 330 262 262" ${stroke(ink, 1.5)} stroke-dasharray="6 6"/>` +
      `<circle cx="120" cy="400" r="8" fill="${accent}"/>`,
  ),
  // The studio's own building, a former tile workshop with a saw-tooth roof.
  "studio-workshop": drawing(
    night,
    `<path d="M40 360H560" ${stroke(light)}/>` +
      hatch(46, 556, 362, "#6d6960") +
      `<path d="M100 360V200L180 140V200L260 140V200L340 140V200L420 140V200L500 140V360" fill="${night}" stroke="${light}" stroke-width="2" stroke-linejoin="round"/>` +
      [180, 260, 340, 420, 500]
        .map(
          (x) =>
            `<path d="M${x} 146V196L${x - 70} 196" fill="none" stroke="#6d6960" stroke-width="1.2"/>`,
        )
        .join("") +
      `<rect x="140" y="250" width="120" height="70" ${stroke(light, 1.6)}/>` +
      lines(3, [170, 250, 170, 320], [30, 0], light, 1.2) +
      `<rect x="330" y="270" width="54" height="90" fill="${accent}"/>` +
      `<rect x="420" y="250" width="50" height="50" ${stroke(light, 1.6)}/>`,
  ),
  // The template library's card: a twelve-column grid with a heavy block and one red dot.
  "studio-cover": drawing(
    paper,
    lines(13, [60, 40, 60, 410], [40, 0], faint, 1) +
      `<rect x="60" y="250" width="320" height="120" fill="${ink}"/>` +
      `<rect x="60" y="80" width="200" height="8" fill="${ink}"/>` +
      `<rect x="60" y="104" width="120" height="8" fill="${ink}"/>` +
      `<path d="M420 250H540M420 280H540M420 310H500" ${stroke(ink, 2)}/>` +
      `<circle cx="500" cy="120" r="20" fill="${accent}"/>`,
  ),
};
