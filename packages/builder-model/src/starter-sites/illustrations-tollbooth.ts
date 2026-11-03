/**
 * The Tollbooth starter site's pictures: ink drawings on cream with one claret accent, like
 * the sketches on a handwritten menu. Drawn from plain shapes; people swap them for their
 * own photos of the room and the food.
 */

const cream = "#efe6d6";
const ink = "#2a211b";
const claret = "#8a2c2c";
const butter = "#e2c48f";
const night = "#1d1814";

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

const stroke = (colour: string, width = 3) =>
  `fill="none" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;

/** Courses of stone, as short offset strokes. */
function stones(x: number, y: number, width: number, height: number): string {
  let path = "";
  for (let row = 0; row * 22 < height; row += 1) {
    const offset = row % 2 === 0 ? 0 : 18;
    for (let column = offset; column < width; column += 36) {
      path += `M${x + column} ${y + row * 22}h24`;
    }
  }
  return `<path d="${path}" ${stroke(ink, 1.4)} opacity="0.45"/>`;
}

export const tollboothIllustrations: Record<string, string> = {
  // The old toll house at dusk: a six-sided stone house with lit windows.
  "tollbooth-cover": landscape(
    night,
    `<path d="M0 380H600" ${stroke(butter, 2)} opacity="0.5"/><path d="M190 380V200L300 130L410 200V380Z" fill="#2c241e" stroke="${butter}" stroke-width="2.5"/><path d="M170 205L300 118L430 205" ${stroke(butter, 3)}/><rect x="282" y="290" width="36" height="90" rx="18" fill="${claret}"/><rect x="215" y="240" width="40" height="52" fill="${butter}"/><rect x="345" y="240" width="40" height="52" fill="${butter}"/><path d="M235 240V292M215 266H255M365 240V292M345 266H385" stroke="#2c241e" stroke-width="3"/><rect x="292" y="82" width="16" height="40" fill="#2c241e" stroke="${butter}" stroke-width="2"/><circle cx="470" cy="90" r="22" fill="${butter}" opacity="0.85"/><path d="M430 380c10-30 40-30 50 0M120 380c8-22 30-22 38 0" ${stroke(butter, 2)} opacity="0.6"/>`,
  ),
  // The house by day, in line.
  "tollbooth-house": landscape(
    cream,
    `<path d="M40 390H560" ${stroke(ink, 2)}/>${stones(196, 214, 210, 170)}<path d="M190 390V205L300 135L410 205V390" ${stroke(ink)}/><path d="M168 210L300 122L432 210" ${stroke(ink, 4)}/><path d="M282 390V318a18 18 0 0 1 36 0V390" fill="${claret}" stroke="${ink}" stroke-width="3"/><rect x="215" y="245" width="40" height="52" fill="${cream}" stroke="${ink}" stroke-width="3"/><rect x="345" y="245" width="40" height="52" fill="${cream}" stroke="${ink}" stroke-width="3"/><path d="M235 245V297M215 271H255M365 245V297M345 271H385" ${stroke(ink, 2)}/><rect x="292" y="86" width="16" height="40" fill="${cream}" stroke="${ink}" stroke-width="3"/><path d="M300 78c-8-14 8-18 0-34" ${stroke(ink, 2)} opacity="0.6"/><path d="M80 390c0-40 40-40 40-80M110 390c0-30-20-50-10-70" ${stroke(ink, 2)}/><path d="M470 390h60M480 372h40" ${stroke(ink, 2)}/>`,
  ),
  // The dining room: one long table under a round-headed window, three candles lit.
  "tollbooth-room": landscape(
    cream,
    `<path d="M220 300V140a80 80 0 0 1 160 0V300Z" fill="#e5d8c1" stroke="${ink}" stroke-width="3"/><path d="M300 60V300M220 180H380" ${stroke(ink, 2)}/><path d="M90 320H510" ${stroke(ink, 5)}/><path d="M120 320V400M480 320V400" ${stroke(ink, 4)}/><path d="M190 320v-38M300 320v-44M410 320v-38" ${stroke(ink, 6)}/><path d="M190 270c-6-8 0-16 0-20c0 4 6 12 0 20ZM300 264c-6-8 0-16 0-20c0 4 6 12 0 20ZM410 270c-6-8 0-16 0-20c0 4 6 12 0 20Z" fill="${claret}"/><circle cx="240" cy="312" r="9" ${stroke(ink, 2)}/><circle cx="360" cy="312" r="9" ${stroke(ink, 2)}/><path d="M60 400H540" ${stroke(ink, 2)} opacity="0.5"/>`,
  ),
  // A plate seen from above: scallops in their shells on greens.
  "tollbooth-plate": portrait(
    cream,
    `<circle cx="240" cy="300" r="170" fill="#f7f0e4" stroke="${ink}" stroke-width="3"/><circle cx="240" cy="300" r="128" ${stroke(ink, 1.5)} opacity="0.5"/><path d="M190 240c30-40 70-40 100 0c-20 10-80 10-100 0Z" fill="${claret}" opacity="0.9"/><path d="M175 330q35-60 70 0q-35 22-70 0ZM245 345q35-60 70 0q-35 22-70 0Z" fill="${butter}" stroke="${ink}" stroke-width="2.5"/><path d="M193 330l17-30l17 30M263 345l17-30l17 30" ${stroke(ink, 1.5)}/><path d="M150 285c20 5 30-15 50-5M300 270c15 10 35-5 45 10" ${stroke(ink, 2)}/><path d="M60 110v120M48 110v40a12 12 0 0 0 24 0v-40M420 110v130M420 110c18 10 18 60 0 70" ${stroke(ink, 3)}/>`,
  ),
  // A sourdough loaf and a knife on a board.
  "tollbooth-bread": portrait(
    cream,
    `<rect x="70" y="330" width="340" height="40" rx="6" fill="#d8c3a1" stroke="${ink}" stroke-width="3"/><path d="M380 350h70" ${stroke(ink, 8)}/><path d="M110 330c0-120 260-120 260 0Z" fill="${butter}" stroke="${ink}" stroke-width="3"/><path d="M170 250c20 20 60 20 80 0M220 230c20 20 60 20 80 0" ${stroke(claret, 4)}/><path d="M90 420h300" ${stroke(ink, 2)} opacity="0.4"/><path d="M110 180l-40-40M150 160l-10-50" ${stroke(ink, 2)} opacity="0.5"/>`,
  ),
  // A glass of red beside the bottle.
  "tollbooth-glass": portrait(
    cream,
    `<path d="M290 470V250c0-40 20-50 20-90V100h40v60c0 40 20 50 20 90v220Z" fill="${night}"/><rect x="300" y="300" width="60" height="70" fill="${cream}" opacity="0.85"/><path d="M312 320h36M312 340h24" ${stroke(ink, 2)}/><path d="M150 200h100c0 80-20 110-50 110s-50-30-50-110Z" fill="none" stroke="${ink}" stroke-width="3"/><path d="M154 240h92c-4 50-20 70-46 70s-42-20-46-70Z" fill="${claret}"/><path d="M200 310v130M160 440h80" ${stroke(ink, 3)}/><path d="M60 470H420" ${stroke(ink, 2)} opacity="0.5"/>`,
  ),
  // The wood grill: flames under a grate.
  "tollbooth-grill": landscape(
    night,
    `<rect x="120" y="260" width="360" height="110" fill="#2c241e" stroke="${butter}" stroke-width="2.5"/><path d="M120 250H480" ${stroke(butter, 4)}/><path d="M150 250V236M210 250V236M270 250V236M330 250V236M390 250V236M450 250V236" ${stroke(butter, 3)}/><path d="M200 250c-20-40 20-60 10-100c30 30 40 60 20 100ZM290 250c-30-50 20-80 10-130c40 40 50 90 20 130ZM380 250c-20-40 20-60 10-100c30 30 40 60 20 100Z" fill="${claret}"/><path d="M215 250c-8-20 8-30 4-50c14 16 16 32 8 50ZM305 250c-10-26 8-40 4-66c18 20 20 44 8 66Z" fill="${butter}"/><path d="M160 300h60M380 330h60" ${stroke(butter, 2)} opacity="0.5"/>`,
  ),
};
