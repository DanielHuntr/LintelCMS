/**
 * The Longplay starter site's pictures: record sleeves drawn as plain geometric
 * compositions, a stage seen from the crowd for the video's poster, the band in outline and
 * the template library's card. Bone, ink and one signal red, with a single muted colour
 * where a sleeve needs it. Sleeves are square, like the real thing.
 */

const bone = "#ece6da";
const ink = "#141311";
const night = "#0e0d0c";
const signal = "#e2492a";
const copper = "#9c5230";
const brick = "#6d4a3c";

const svg = (width: number, height: number, background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><rect width="${width}" height="${height}" fill="${background}"/>${body}</svg>`;

const sleeve = (background: string, body: string) => svg(600, 600, background, body);

/** Horizontal lines that open out towards the viewer, like a flat sea. */
function seaLines(): string {
  const lines: string[] = [];
  let y = 330;
  for (let step = 0; step < 14; step += 1) {
    lines.push(`<rect x="60" y="${Math.round(y)}" width="480" height="2" fill="${ink}"/>`);
    y += 6 + step * 1.6;
  }
  return lines.join("");
}

/** A row of a night bus's windows, one of them lit red. */
function busWindows(): string {
  const windows: string[] = [];
  for (let column = 0; column < 8; column += 1) {
    const fill = column === 5 ? signal : column % 3 === 0 ? "#3b3832" : "#d9cfb8";
    windows.push(
      `<rect x="${102 + column * 52}" y="262" width="40" height="44" rx="4" fill="${fill}"/>`,
    );
  }
  return windows.join("");
}

/** Slanted rain in a few lengths and strengths. */
function rain(): string {
  const strokes: string[] = [];
  for (let index = 0; index < 46; index += 1) {
    const x = (index * 97) % 640;
    const y = (index * 61) % 560;
    const length = 40 + ((index * 13) % 70);
    const opacity = 0.35 + ((index * 7) % 6) / 10;
    strokes.push(
      `<path d="M${x} ${y} l-${Math.round(length * 0.4)} ${length}" stroke="${bone}" stroke-width="3" stroke-linecap="round" opacity="${opacity.toFixed(2)}"/>`,
    );
  }
  return strokes.join("");
}

/** A mill's arched windows, four floors of six, one lit. */
function millWindows(): string {
  const windows: string[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const x = 104 + column * 66;
      const y = 196 + row * 78;
      const fill = row === 1 && column === 4 ? signal : "#2a2420";
      windows.push(
        `<path d="M${x} ${y + 50} V${y + 16} a18 18 0 0 1 36 0 V${y + 50} Z" fill="${fill}"/>`,
      );
    }
  }
  return windows.join("");
}

/** A record's grooves: rings closing in on the label. */
function grooves(cx: number, cy: number, outer: number): string {
  const rings: string[] = [];
  for (let radius = outer - 8; radius > outer * 0.42; radius -= 7) {
    rings.push(
      `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#2d2b27" stroke-width="1.5"/>`,
    );
  }
  return rings.join("");
}

/** A microphone stand on the stage floor. */
function micStand(x: number): string {
  return `<path d="M${x} 392 V250 l26 -22" stroke="${bone}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="${x + 28}" cy="226" r="7" fill="${bone}"/><path d="M${x - 22} 394 h44" stroke="${bone}" stroke-width="4" stroke-linecap="round"/>`;
}

/** One of the band in outline: a head and shoulders, and what they play. */
function figure(x: number, instrument: string): string {
  const line = `stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return `<circle cx="${x}" cy="210" r="30" ${line}/><path d="M${x - 52} 470 V320 q0 -64 52 -64 q52 0 52 64 V470" ${line}/>${instrument}`;
}

export const longplayIllustrations: Record<string, string> = {
  // Salt Lines (album): a low red sun cut by the sea.
  "longplay-salt-lines": sleeve(
    bone,
    `<circle cx="300" cy="330" r="132" fill="${signal}"/><rect x="0" y="330" width="600" height="270" fill="${bone}"/>${seaLines()}<rect x="60" y="60" width="480" height="3" fill="${ink}"/>`,
  ),
  // Night Bus Hymns (EP): a lit bus crossing the dark.
  "longplay-night-bus": sleeve(
    night,
    `<rect x="80" y="236" width="440" height="128" rx="18" fill="#26241f"/>${busWindows()}<rect x="80" y="330" width="440" height="6" fill="#3b3832"/><circle cx="160" cy="372" r="22" fill="${night}" stroke="#3b3832" stroke-width="6"/><circle cx="440" cy="372" r="22" fill="${night}" stroke="#3b3832" stroke-width="6"/><rect x="0" y="402" width="600" height="2" fill="#3b3832"/>`,
  ),
  // Kingsway (single): a long straight road at night.
  "longplay-kingsway": sleeve(
    ink,
    `<path d="M300 170 L40 600 H560 Z" fill="#26241f"/><path d="M300 170 L40 600 M300 170 L560 600" stroke="${bone}" stroke-width="3"/><path d="M300 200 V600" stroke="${signal}" stroke-width="6" stroke-dasharray="26 22"/><rect x="0" y="168" width="600" height="2" fill="${bone}" opacity="0.5"/><circle cx="300" cy="120" r="6" fill="${bone}"/>`,
  ),
  // Copper Rain (album): rain slanting across copper.
  "longplay-copper-rain": sleeve(
    copper,
    `${rain()}<rect x="60" y="470" width="180" height="70" fill="${ink}"/><rect x="76" y="486" width="148" height="4" fill="${bone}"/><rect x="76" y="500" width="96" height="4" fill="${bone}"/>`,
  ),
  // Ancoats Tapes (EP): a cotton mill's windows, one lit.
  "longplay-ancoats": sleeve(
    "#d8cbb4",
    `<rect x="84" y="170" width="432" height="350" fill="${brick}"/><rect x="430" y="70" width="40" height="100" fill="${brick}"/>${millWindows()}<rect x="0" y="520" width="600" height="80" fill="${ink}"/>`,
  ),
  // The video's poster: the stage from the crowd, before the band walks on.
  "longplay-stage": svg(
    960,
    540,
    night,
    `<path d="M480 0 L300 400 H660 Z" fill="${bone}" opacity="0.08"/><path d="M180 0 L120 400 H330 Z" fill="${bone}" opacity="0.05"/><path d="M780 0 L630 400 H840 Z" fill="${bone}" opacity="0.05"/><rect x="0" y="392" width="960" height="148" fill="#1d1b18"/><rect x="0" y="392" width="960" height="3" fill="#3b3832"/><rect x="96" y="300" width="120" height="92" fill="#26241f"/><rect x="744" y="300" width="120" height="92" fill="#26241f"/><circle cx="156" cy="346" r="26" fill="#3b3832"/><circle cx="804" cy="346" r="26" fill="#3b3832"/>${micStand(330)}${micStand(470)}${micStand(610)}<rect x="430" y="455" width="100" height="6" fill="${signal}"/>`,
  ),
  // The four of them in outline: guitar, bass, drums and keys.
  "longplay-band": svg(
    960,
    600,
    bone,
    `${figure(150, `<path d="M112 392 l100 -70" stroke="${signal}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="134" cy="378" r="24" fill="none" stroke="${signal}" stroke-width="5"/>`)}${figure(370, `<path d="M326 404 l112 -98" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><circle cx="346" cy="388" r="22" fill="none" stroke="${ink}" stroke-width="5"/>`)}${figure(590, `<ellipse cx="590" cy="470" rx="80" ry="24" fill="${bone}" stroke="${ink}" stroke-width="5"/><path d="M560 330 l-40 -50 M620 330 l40 -50" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>`)}${figure(810, `<rect x="730" y="400" width="160" height="26" fill="${ink}"/><path d="M746 400 v26 M770 400 v26 M794 400 v26 M818 400 v26 M842 400 v26 M866 400 v26" stroke="${bone}" stroke-width="3"/>`)}<rect x="40" y="520" width="880" height="3" fill="${ink}"/>`,
  ),
  // The template library's card: a record sliding out of its sleeve.
  "longplay-cover": svg(
    600,
    450,
    night,
    `<circle cx="370" cy="225" r="150" fill="${ink}"/>${grooves(370, 225, 150)}<circle cx="370" cy="225" r="52" fill="${signal}"/><circle cx="370" cy="225" r="6" fill="${night}"/><rect x="70" y="75" width="300" height="300" fill="${bone}"/><circle cx="220" cy="230" r="70" fill="${signal}"/><rect x="70" y="230" width="300" height="145" fill="${bone}"/><rect x="100" y="250" width="240" height="2" fill="${ink}"/><rect x="100" y="262" width="240" height="2" fill="${ink}"/><rect x="100" y="278" width="240" height="2" fill="${ink}"/><rect x="100" y="298" width="240" height="2" fill="${ink}"/><rect x="100" y="324" width="240" height="2" fill="${ink}"/>`,
  ),
};
