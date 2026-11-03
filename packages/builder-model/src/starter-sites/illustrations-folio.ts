/**
 * The Folio starter site's pictures: quiet, warm-grey studies that stand in for a
 * photographer's work until people add their own photos. Each one is drawn from plain shapes,
 * portrait way up (4:5), except the cover, which is the template library's card.
 */

const paper = "#ebe8e2";
const stone = "#cfcac0";
const clay = "#a9a49a";
const slate = "#6f6b63";
const ink = "#2a2926";
const night = "#171715";

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

/** A concrete block's windows, a few of them lit. */
function towerWindows(): string {
  const lit = new Set(["1-3", "4-1", "2-6", "5-8", "0-10", "3-11"]);
  const windows: string[] = [];
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const fill = lit.has(`${column}-${row}`) ? "#e9dfc6" : "#3a3834";
      windows.push(
        `<rect x="${112 + column * 44}" y="${110 + row * 40}" width="26" height="22" fill="${fill}"/>`,
      );
    }
  }
  return windows.join("");
}

/** A contact sheet: twelve small frames, one ringed in red pencil. */
function contactSheet(): string {
  const frames: string[] = [];
  const tones = [slate, ink, clay, ink, slate, clay, ink, slate, clay, ink, slate, ink];
  tones.forEach((tone, index) => {
    const x = 92 + (index % 4) * 108;
    const y = 92 + Math.floor(index / 4) * 92;
    frames.push(`<rect x="${x}" y="${y}" width="92" height="70" fill="${tone}"/>`);
    frames.push(
      `<rect x="${x + 18 + (index % 3) * 10}" y="${y + 28}" width="${30 + (index % 2) * 16}" height="${42 - (index % 2) * 10}" fill="${paper}" opacity="0.35"/>`,
    );
  });
  return frames.join("");
}

export const folioIllustrations: Record<string, string> = {
  "folio-cover": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${night}"/><rect x="72" y="72" width="456" height="306" fill="${paper}"/>${contactSheet()}<ellipse cx="354" cy="219" rx="64" ry="48" fill="none" stroke="#c4462b" stroke-width="5" transform="rotate(-8 354 219)"/></svg>`,
  "folio-stair": portrait(
    ink,
    `<circle cx="240" cy="300" r="236" fill="${stone}"/><circle cx="252" cy="288" r="188" fill="${clay}"/><circle cx="262" cy="278" r="146" fill="${slate}"/><circle cx="270" cy="270" r="108" fill="#4a4741"/><circle cx="276" cy="264" r="74" fill="#33312d"/><circle cx="280" cy="260" r="42" fill="${paper}"/><path d="M280 260 L40 160 M280 260 L90 470 M280 260 L330 540 M280 260 L470 420 M280 260 L460 120 M280 260 L230 40" stroke="${ink}" stroke-width="3" opacity="0.35"/>`,
  ),
  "folio-window": portrait(
    "#c4bfb5",
    `<rect y="470" width="480" height="130" fill="${clay}"/><path d="M118 92 L222 74 L250 300 L146 326 Z M240 70 L322 56 L350 268 L270 290 Z" fill="#f1eee8"/><path d="M168 470 L300 470 L390 600 L214 600 Z" fill="#e2ded6"/><path d="M146 326 L250 300 L252 316 L148 344 Z" fill="${clay}" opacity="0.6"/>`,
  ),
  "folio-vessel": portrait(
    "#e3dfd7",
    `<ellipse cx="300" cy="330" rx="96" ry="120" fill="${stone}"/><rect x="120" y="408" width="240" height="192" fill="${stone}"/><rect x="120" y="400" width="240" height="14" fill="#f1eee8"/><path d="M204 402 C146 382 146 270 206 250 C216 246 216 222 206 214 L274 214 C264 222 264 246 274 250 C334 270 334 382 276 402 Z" fill="${ink}"/><path d="M196 300 C196 278 206 264 220 258" stroke="${slate}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  ),
  "folio-horizon": portrait(
    "#dcd8cf",
    `<circle cx="240" cy="352" r="52" fill="#f4f1eb"/><rect y="352" width="480" height="248" fill="#8f8a80"/><path d="M200 380 H280 M214 404 H266 M224 428 H256 M232 452 H248" stroke="#e9e5dd" stroke-width="5" stroke-linecap="round"/><path d="M0 500 H480 M0 548 H480" stroke="#7f7a70" stroke-width="2"/>`,
  ),
  "folio-chair": portrait(
    "#ebe8e2",
    `<rect y="440" width="480" height="160" fill="#d6d2c9"/><path d="M262 440 L330 200 L374 200 L390 440 L470 600 L330 600 Z" fill="${stone}" opacity="0.9"/><g stroke="${ink}" stroke-width="10" stroke-linecap="square" fill="none"><path d="M150 210 V500 M250 210 V500 M150 210 H250 M150 250 H250 M150 380 H262 M190 380 V520 M262 380 V530"/></g><rect x="140" y="372" width="132" height="16" fill="${ink}"/>`,
  ),
  "folio-tower": portrait(
    "#4a4741",
    `<rect x="90" y="84" width="300" height="516" fill="#8f8a80"/><rect x="90" y="84" width="300" height="10" fill="#a9a49a"/>${towerWindows()}`,
  ),
  "folio-arch": portrait(
    "#e3dfd7",
    `<path d="M40 600 V280 A60 60 0 0 1 160 280 V600 Z M180 600 V280 A60 60 0 0 1 300 280 V600 Z M320 600 V280 A60 60 0 0 1 440 280 V600 Z" fill="${ink}"/><path d="M60 600 L110 470 L160 470 L160 600 Z M200 600 L250 470 L300 470 L300 600 Z M340 600 L390 470 L440 470 L440 600 Z" fill="${clay}"/><rect y="150" width="480" height="18" fill="${stone}"/>`,
  ),
  "folio-fold": portrait(
    ink,
    `<rect y="330" width="480" height="270" fill="#3a3834"/><path d="M70 0 H330 C350 120 320 250 360 330 C380 420 340 520 370 600 H110 C90 500 130 420 100 330 C70 240 100 110 70 0 Z" fill="#d8d3c9"/><path d="M150 0 C170 120 140 230 180 330 C210 420 170 520 200 600 M250 0 C270 140 240 240 280 330 C300 430 270 520 290 600" stroke="${clay}" stroke-width="10" fill="none"/>`,
  ),
  "folio-portrait": portrait(
    "#e3dfd7",
    `<path d="M60 600 C80 474 170 444 240 444 C310 444 400 474 420 600 Z" fill="${ink}"/><rect x="212" y="378" width="56" height="80" fill="${clay}"/><ellipse cx="240" cy="298" rx="88" ry="108" fill="${clay}"/><path d="M146 322 C130 200 190 166 242 166 C300 166 352 204 336 322 C332 346 324 360 318 368 L318 268 C282 246 198 246 164 268 L164 368 C158 360 150 346 146 322 Z" fill="${ink}"/><rect x="166" y="236" width="40" height="22" rx="4" fill="${night}"/><rect x="146" y="252" width="188" height="104" rx="10" fill="${night}"/><circle cx="252" cy="304" r="40" fill="#3a3834" stroke="#e3dfd7" stroke-width="4"/><circle cx="252" cy="304" r="18" fill="${slate}"/><rect x="122" y="278" width="34" height="84" rx="16" fill="${clay}"/><rect x="324" y="278" width="34" height="84" rx="16" fill="${clay}"/><path d="M224 384 Q240 394 256 384" stroke="${slate}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  ),
};
