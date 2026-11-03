/**
 * The Threshold starter site's pictures: line drawings of Bath stone houses, streets and
 * hills, in two stone tones, dark ink and one terracotta (the front doors). They stand in for
 * photographs of homes until the agent adds their own. Most are 4:3; the home page's
 * terrace is wide.
 */

const sky = "#f1eadd";
const stone = "#dccaa8";
const shade = "#c4ad86";
const ink = "#3a3027";
const door = "#b4553a";
const glass = "#efe6d6";

const svg = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><rect width="${width}" height="${height}" fill="${sky}"/><g stroke="${ink}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

const frame = (body: string) => svg(600, 450, body);

/** A sash window: the frame, the meeting rail and a glazing bar. */
function sash(x: number, y: number, width: number, height: number): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${glass}"/><path d="M${x} ${y + height / 2}h${width}M${x + width / 2} ${y}v${height}" fill="none"/>`;
}

/** A panelled front door with a fanlight over it. */
function frontDoor(x: number, y: number, width: number, height: number): string {
  const radius = width / 2;
  const panel = width / 2 - 9;
  const panelHeight = height / 2 - 12;
  return `<path d="M${x} ${y}a${radius} ${radius} 0 0 1 ${width} 0z" fill="${glass}"/><path d="M${x + radius} ${y}v${-radius}" fill="none" stroke-width="1.5"/><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${door}"/><path d="M${x + 6} ${y + 8}h${panel}v${panelHeight}h${-panel}zM${x + width / 2 + 3} ${y + 8}h${panel}v${panelHeight}h${-panel}z" fill="none" stroke-width="1.5"/>`;
}

/** An arched window, such as a mill's. */
function archedWindow(x: number, y: number, width: number, height: number): string {
  const radius = width / 2;
  return `<path d="M${x} ${y + height}V${y + radius}a${radius} ${radius} 0 0 1 ${width} 0V${y + height}z" fill="${glass}"/><path d="M${x + radius} ${y}v${height}" fill="none" stroke-width="1.5"/>`;
}

/** Railings along the pavement. */
function railings(from: number, to: number, top: number, bottom: number): string {
  let bars = "";
  for (let x = from; x <= to; x += 9) bars += `M${x} ${top}V${bottom}`;
  return `<path d="M${from} ${top + 4}H${to}${bars}" fill="none" stroke-width="1.5"/>`;
}

/** A long Georgian terrace of `bays` bays, starting at `left`, standing on `ground`. */
function terraceRow(left: number, ground: number, bays: number, bay: number): string {
  const top = ground - 330;
  const width = bays * bay;
  let parts = `<rect x="${left}" y="${top}" width="${width}" height="330" fill="${stone}"/><rect x="${left - 8}" y="${top - 14}" width="${width + 16}" height="14" fill="${shade}"/><path d="M${left} ${ground - 110}H${left + width}" fill="none"/>`;
  for (let index = 0; index < bays; index += 1) {
    const x = left + index * bay + (bay - 38) / 2;
    parts += sash(x, top + 26, 38, 46);
    parts += sash(x, top + 104, 38, 92);
    parts += index % 3 === 1 ? frontDoor(x - 2, ground - 84, 42, 84) : sash(x, ground - 88, 38, 62);
  }
  return parts;
}

/** Little houses stepping up a hillside, each a box with a roof and a lit window. */
function hillHouses(places: readonly (readonly [number, number])[]): string {
  return places
    .map(
      ([x, y]) =>
        `<rect x="${x}" y="${y}" width="60" height="44" fill="${stone}"/><path d="M${x - 4} ${y}L${x + 30} ${y - 20}L${x + 64} ${y}z" fill="${shade}"/><rect x="${x + 22}" y="${y + 12}" width="16" height="20" fill="${glass}"/>`,
    )
    .join("");
}

/** A shopfront with a flat above it: two windows, a fascia, an awning, a window and a door. */
function shop(x: number, index: number): string {
  const awning = index === 1 ? door : glass;
  const shopDoor = index === 2 ? door : stone;
  return `<rect x="${x}" y="110" width="130" height="280" fill="${index % 2 ? shade : stone}"/>${sash(x + 22, 136, 34, 50)}${sash(x + 74, 136, 34, 50)}<rect x="${x}" y="210" width="130" height="22" fill="${sky}"/><path d="M${x} 242h130l-10 26h-110z" fill="${awning}"/><rect x="${x + 14}" y="284" width="64" height="106" fill="${glass}"/><rect x="${x + 86}" y="290" width="32" height="100" fill="${shopDoor}"/>`;
}

const cobbles = Array.from({ length: 11 }, (_, index) => {
  const x = 20 + index * 50;
  return `M${x} 410h30M${x + 25} 428h30`;
}).join("");

const millWindows = [100, 172, 244, 316, 388, 460]
  .map(
    (x) =>
      archedWindow(x, 150, 40, 56) + archedWindow(x, 232, 40, 56) + archedWindow(x, 316, 40, 56),
  )
  .join("");

export const thresholdIllustrations: Record<string, string> = {
  "threshold-crescent": svg(
    1200,
    675,
    `<circle cx="930" cy="170" r="70" fill="${stone}" stroke="none"/><path d="M0 330C220 250 420 300 620 250S1000 210 1200 270V675H0z" fill="${shade}" stroke="none" opacity="0.55"/>${terraceRow(60, 600, 12, 90)}<path d="M0 600H1200" fill="none"/>${railings(60, 1140, 572, 600)}<path d="M0 640H1200" fill="none" stroke-width="1" stroke-dasharray="2 10"/>`,
  ),
  "threshold-terrace": frame(
    `<rect x="40" y="96" width="130" height="294" fill="${shade}" opacity="0.5"/><rect x="430" y="96" width="130" height="294" fill="${shade}" opacity="0.5"/><rect x="170" y="96" width="260" height="294" fill="${stone}"/><rect x="160" y="82" width="280" height="14" fill="${shade}"/>${sash(196, 116, 44, 52)}${sash(278, 116, 44, 52)}${sash(360, 116, 44, 52)}${sash(196, 190, 44, 90)}${sash(278, 190, 44, 90)}${sash(360, 190, 44, 90)}<path d="M170 290H430" fill="none"/>${sash(196, 312, 44, 62)}${frontDoor(278, 306, 44, 84)}${sash(360, 312, 44, 62)}<path d="M20 390H580" fill="none"/>${railings(40, 160, 362, 390)}${railings(440, 560, 362, 390)}`,
  ),
  "threshold-cottage": frame(
    `<circle cx="96" cy="250" r="62" fill="${shade}" opacity="0.7"/><path d="M96 312V380" fill="none"/><path d="M140 226L192 132H408L460 226z" fill="${shade}"/><rect x="384" y="98" width="30" height="50" fill="${stone}"/><rect x="152" y="224" width="296" height="156" fill="${stone}"/>${sash(184, 258, 58, 52)}${sash(358, 258, 58, 52)}<rect x="280" y="296" width="40" height="84" fill="${door}"/><path d="M272 290h56" fill="none"/><rect x="0" y="352" width="600" height="28" fill="${stone}"/><path d="M0 352H600M0 380H600" fill="none"/><path d="M60 352v28M140 352v28M220 352v28M380 352v28M460 352v28M540 352v28" fill="none" stroke-width="1"/>`,
  ),
  "threshold-mews": frame(
    `<rect x="110" y="140" width="380" height="250" fill="${stone}"/><rect x="100" y="128" width="400" height="12" fill="${shade}"/>${sash(150, 170, 52, 56)}${sash(274, 170, 52, 56)}${sash(398, 170, 52, 56)}<path d="M160 390V306a70 70 0 0 1 140 0V390z" fill="${door}"/><path d="M230 236v154M160 330H300" fill="none" stroke-width="1.5"/><rect x="360" y="300" width="40" height="90" fill="${door}"/>${sash(414, 306, 44, 50)}<path d="M0 390H600" fill="none"/><path d="${cobbles}" fill="none" stroke-width="1"/>`,
  ),
  "threshold-flat": frame(
    `<rect x="0" y="360" width="600" height="90" fill="${shade}" opacity="0.6"/><path d="M0 360H600M0 390H600M0 420H600M120 360v30M300 390v30M460 360v30M200 420v30M520 420v30" fill="none" stroke-width="1"/><rect x="228" y="60" width="150" height="272" fill="${glass}"/><path d="M228 196H378M278 60V332M328 60V332M228 128H378M228 264H378" fill="none" stroke-width="1.5"/><path d="M216 332H390" fill="none" stroke-width="4"/><path d="M60 350V270q0-30 30-30h60q30 0 30 30V350M50 350V292h20M190 350V292h-20" fill="${door}"/><path d="M70 300h100" fill="none"/><path d="M490 350V140M470 350h40" fill="none"/><path d="M462 140h56l-12-46h-32z" fill="${stone}"/>`,
  ),
  "threshold-villa": frame(
    `<circle cx="90" cy="290" r="54" fill="${shade}" opacity="0.7"/><circle cx="510" cy="280" r="60" fill="${shade}" opacity="0.7"/><path d="M90 344V390M510 340V390" fill="none"/><path d="M150 206L216 128H384L450 206z" fill="${shade}"/><rect x="166" y="204" width="268" height="186" fill="${stone}"/><rect x="180" y="276" width="76" height="114" fill="${stone}"/><rect x="344" y="276" width="76" height="114" fill="${stone}"/>${sash(194, 296, 48, 70)}${sash(358, 296, 48, 70)}${sash(196, 222, 44, 40)}${sash(360, 222, 44, 40)}${frontDoor(280, 306, 40, 84)}<path d="M0 390H600" fill="none"/><path d="M264 390h72v8h-72z" fill="${stone}"/>`,
  ),
  "threshold-loft": frame(
    `<rect x="70" y="120" width="460" height="270" fill="${stone}"/><path d="M60 120L300 70L540 120z" fill="${shade}"/>${millWindows}<rect x="244" y="316" width="40" height="74" fill="${door}"/><path d="M0 390H600" fill="none"/><path d="M0 420C120 410 240 432 360 420S540 410 600 420" fill="none" stroke-width="1"/>`,
  ),
  "threshold-widcombe": frame(
    `<path d="M0 250L600 120V340H0z" fill="${shade}" opacity="0.55"/>${hillHouses([
      [60, 228],
      [140, 210],
      [220, 193],
      [300, 176],
      [380, 159],
      [460, 141],
    ])}<rect x="0" y="340" width="600" height="110" fill="${glass}"/><path d="M0 340H600" fill="none"/><path d="M40 380h80M200 400h120M380 372h90M470 420h100M90 428h70" fill="none" stroke-width="1"/><path d="M200 340V300H260V340M340 340V300H400V340" fill="none"/><path d="M180 300H420" fill="none" stroke-width="4"/><path d="M230 340l60 60M370 340l-60 60" stroke="${door}" stroke-width="6" fill="none"/>`,
  ),
  "threshold-larkhall": frame(
    `${[30, 170, 310, 450].map((x, index) => shop(x, index)).join("")}<path d="M0 390H600M0 420H600" fill="none"/>`,
  ),
  "threshold-lansdown": frame(
    `<circle cx="470" cy="110" r="40" fill="${stone}" stroke="none"/><path d="M0 220C150 150 330 140 600 200V450H0z" fill="${shade}" opacity="0.6"/><path d="M90 236C180 190 300 180 400 196" fill="none" stroke-width="16" stroke="${stone}"/><path d="M90 236C180 190 300 180 400 196" fill="none" stroke-dasharray="6 6" stroke-width="10" opacity="0.6"/><path d="M0 320C200 250 400 270 600 310V450H0z" fill="${stone}"/><path d="M60 450C140 400 180 340 260 300" fill="none" stroke-width="1" stroke-dasharray="4 6"/><path d="M380 360v-40M380 320l-14 18M380 320l14 18M420 372v-30M420 342l-10 14M420 342l10 14" fill="none"/>`,
  ),
  "threshold-cover": frame(
    `<rect x="170" y="40" width="260" height="360" fill="${stone}"/><rect x="200" y="70" width="200" height="22" fill="${shade}"/>${frontDoor(250, 190, 100, 186)}<path d="M240 100V376M360 100V376" fill="none" stroke-width="6" stroke="${shade}"/><path d="M150 376H450V392H150zM130 392H470V410H130z" fill="${shade}"/><circle cx="334" cy="290" r="4" fill="${ink}"/>`,
  ),
};
