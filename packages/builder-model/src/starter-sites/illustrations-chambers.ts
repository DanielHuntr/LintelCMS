/**
 * The Chambers starter site's pictures: fine line drawings in deep green ink on warm paper,
 * with a single touch of oxblood. A New Town doorway, its fanlight, a desk, a ledger, a pen
 * and a door key stand in for photographs of the office until people add their own.
 */

const paper = "#f1ece1";
const ink = "#1f3a32";
const faint = "#b9b29f";
const oxblood = "#7a2e2a";

const line = `fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
const thin = `fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"`;

const landscape = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${paper}"/>${body}</svg>`;

const portrait = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${paper}"/>${body}</svg>`;

/** The spokes of a semicircular fanlight, centred on (cx, cy). */
function fanlight(cx: number, cy: number, radius: number): string {
  const spokes: string[] = [];
  for (let index = 1; index < 8; index += 1) {
    const angle = Math.PI - (Math.PI * index) / 8;
    const x = (cx + Math.cos(angle) * radius).toFixed(1);
    const y = (cy - Math.sin(angle) * radius).toFixed(1);
    spokes.push(`<path d="M${cx} ${cy} L${x} ${y}" ${thin}/>`);
  }
  const inner = radius * 0.35;
  return [
    `<path d="M${cx - radius} ${cy} A${radius} ${radius} 0 0 1 ${cx + radius} ${cy} Z" ${line}/>`,
    `<path d="M${cx - inner} ${cy} A${inner} ${inner} 0 0 1 ${cx + inner} ${cy}" ${thin}/>`,
    ...spokes,
  ].join("");
}

/** Six raised panels of a Georgian door, drawn in paper-coloured lines on the painted door. */
function doorPanels(x: number, y: number, width: number, height: number): string {
  const panelWidth = (width - 36) / 2;
  const panels: string[] = [];
  let top = y + 14;
  for (const share of [0.22, 0.38, 0.4]) {
    const panelHeight = (height - 56) * share;
    for (const column of [0, 1]) {
      panels.push(
        `<rect x="${x + 12 + column * (panelWidth + 12)}" y="${top.toFixed(1)}" width="${panelWidth}" height="${panelHeight.toFixed(1)}" fill="none" stroke="${paper}" stroke-width="1.5"/>`,
      );
    }
    top += panelHeight + 14;
  }
  return panels.join("");
}

/** Courses of stone either side of a doorway. */
function stonework(from: number, to: number, left: number, right: number): string {
  const courses: string[] = [];
  for (let y = from; y <= to; y += 36) {
    courses.push(`<path d="M${left} ${y} H${right}" stroke="${faint}" stroke-width="1.5"/>`);
  }
  return courses.join("");
}

/** The ruled lines of a page. */
function ruledLines(x: number, y: number, width: number, count: number): string {
  const lines: string[] = [];
  for (let index = 0; index < count; index += 1) {
    lines.push(
      `<path d="M${x} ${y + index * 22} H${x + width}" stroke="${faint}" stroke-width="1.5"/>`,
    );
  }
  return lines.join("");
}

const doorway = portrait(
  [
    stonework(70, 560, 40, 440),
    `<rect x="120" y="60" width="240" height="500" fill="${paper}"/>`,
    `<path d="M120 560 V200 M360 560 V200 M104 200 H376" ${line}/>`,
    fanlight(240, 196, 120),
    `<rect x="140" y="214" width="200" height="346" fill="${oxblood}"/>`,
    doorPanels(140, 214, 200, 346),
    `<circle cx="240" cy="380" r="9" fill="${paper}"/>`,
    `<path d="M80 560 H400 M66 578 H414" ${line}/>`,
  ].join(""),
);

const fanlightDrawing = landscape(
  [
    `<path d="M60 380 H540 M70 344 H530" ${line}/>`,
    fanlight(300, 330, 210),
    `<circle cx="300" cy="96" r="6" fill="${oxblood}"/>`,
  ].join(""),
);

const desk = landscape(
  [
    `<path d="M70 300 H530 M100 300 V400 M500 300 V400 M360 300 V400 M360 340 H500 M360 370 H500" ${line}/>`,
    `<circle cx="430" cy="355" r="3" fill="${ink}"/><circle cx="430" cy="385" r="3" fill="${ink}"/>`,
    `<path d="M150 300 h50 M175 300 V200 l40 -50" ${line}/>`,
    `<path d="M200 140 l50 -10 l10 40 z" fill="${oxblood}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="M270 296 h110 M276 286 h100 M268 276 h112" ${line}/>`,
    `<path d="M420 266 h40 v24 a14 14 0 0 1 -14 10 h-12 a14 14 0 0 1 -14 -10 z M460 272 a10 10 0 0 1 0 16" ${line}/>`,
  ].join(""),
);

const ledger = landscape(
  [
    `<path d="M80 340 L300 360 L520 340 V110 L300 130 L80 110 Z M300 130 V360" ${line}/>`,
    ruledLines(110, 160, 160, 8),
    ruledLines(330, 160, 160, 8),
    `<path d="M240 140 V340 M460 140 V340" stroke="${oxblood}" stroke-width="1.5"/>`,
    `<path d="M120 182 h70 M120 204 h90 M120 226 h50 M340 182 h80 M340 204 h60" ${thin}/>`,
    `<path d="M250 182 h14 M250 204 h12 M250 226 h14 M470 182 h12 M470 204 h14" ${thin}/>`,
  ].join(""),
);

const pen = landscape(
  [
    ruledLines(120, 140, 360, 7),
    `<path d="M150 260 c40 -30 70 30 110 0 s60 -20 90 4" ${line}/>`,
    `<path d="M160 330 L470 170" stroke="${ink}" stroke-width="16" stroke-linecap="round"/>`,
    `<path d="M410 201 L470 170" stroke="${oxblood}" stroke-width="16" stroke-linecap="round"/>`,
    `<path d="M160 330 l-28 16 l10 -30 z" fill="${ink}"/>`,
  ].join(""),
);

const key = landscape(
  [
    `<circle cx="200" cy="225" r="62" ${line}/>`,
    `<circle cx="200" cy="225" r="26" ${line}/>`,
    `<path d="M262 225 H470 V262 M430 225 V252 M396 225 V244" ${line}/>`,
    `<path d="M150 360 c30 -30 60 -30 90 0" ${thin}/>`,
    `<rect x="132" y="360" width="126" height="40" rx="6" fill="${oxblood}"/>`,
    `<path d="M150 380 H240" stroke="${paper}" stroke-width="2"/>`,
  ].join(""),
);

const cover = landscape(
  [
    stonework(40, 430, 0, 600),
    `<rect x="190" y="30" width="220" height="420" fill="${paper}"/>`,
    fanlight(300, 160, 110),
    `<path d="M178 160 H422 M190 450 V160 M410 450 V160" ${line}/>`,
    `<rect x="208" y="176" width="184" height="274" fill="${oxblood}"/>`,
    doorPanels(208, 176, 184, 274),
    `<circle cx="300" cy="320" r="7" fill="${paper}"/>`,
  ].join(""),
);

export const chambersIllustrations: Record<string, string> = {
  "chambers-cover": cover,
  "chambers-doorway": doorway,
  "chambers-fanlight": fanlightDrawing,
  "chambers-desk": desk,
  "chambers-ledger": ledger,
  "chambers-pen": pen,
  "chambers-key": key,
};
