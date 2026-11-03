/**
 * The Longwave starter site's pictures: square episode covers drawn from the tools and
 * objects each guest mends, a microphone, the show's waveform and the two hosts. Deep ink,
 * cream and one amber, flat shapes with fine lines, so they sit together like a series.
 */

const ink = "#13213a";
const deep = "#1d2e4d";
const slate = "#3b4a66";
const cream = "#f1ead9";
const paper = "#e4d9c0";
const amber = "#d99a1e";

const square = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img"><rect width="600" height="600" fill="${background}"/>${body}</svg>`;

const wide = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" role="img"><rect width="1200" height="600" fill="${background}"/>${body}</svg>`;

/** Bars of a waveform, from fixed heights so the picture is the same every time. */
function waveform(x: number, middle: number, step: number, heights: readonly number[]): string {
  return heights
    .map(
      (height, index) =>
        `<rect x="${x + index * step}" y="${middle - height / 2}" width="${step * 0.45}" height="${height}" rx="${step * 0.22}"/>`,
    )
    .join("");
}

const waveHeights = [
  18, 34, 60, 42, 96, 150, 120, 70, 44, 88, 190, 240, 170, 110, 64, 130, 210, 160, 90, 52, 36, 80,
  140, 220, 260, 200, 120, 76, 48, 100, 170, 128, 66, 40, 24, 58, 112, 86, 46, 28, 16, 30, 54, 38,
  22, 14,
];

/** The twelve marks round a clock face. */
function clockMarks(): string {
  const marks: string[] = [];
  for (let hour = 0; hour < 12; hour += 1) {
    const angle = (hour * Math.PI) / 6;
    const inner = hour % 3 === 0 ? 150 : 166;
    const x1 = (300 + Math.sin(angle) * inner).toFixed(1);
    const y1 = (300 - Math.cos(angle) * inner).toFixed(1);
    const x2 = (300 + Math.sin(angle) * 184).toFixed(1);
    const y2 = (300 - Math.cos(angle) * 184).toFixed(1);
    marks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  return marks.join("");
}

/** The spokes of a wheel. */
function spokes(): string {
  const lines: string[] = [];
  for (let spoke = 0; spoke < 16; spoke += 1) {
    const angle = (spoke * Math.PI) / 8;
    lines.push(
      `<line x1="300" y1="300" x2="${(300 + Math.cos(angle) * 176).toFixed(1)}" y2="${(300 + Math.sin(angle) * 176).toFixed(1)}"/>`,
    );
  }
  return lines.join("");
}

/** A square of woven darning: threads across and down. */
function darning(): string {
  const across = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((row) => `<line x1="140" y1="${180 + row * 32}" x2="460" y2="${180 + row * 32}"/>`)
    .join("");
  const down = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    .map(
      (column) => `<line x1="${150 + column * 30}" y1="170" x2="${150 + column * 30}" y2="420"/>`,
    )
    .join("");
  return across + down;
}

export const longwaveIllustrations: Record<string, string> = {
  "longwave-cover": wide(
    ink,
    `<g fill="${slate}">${waveform(80, 300, 22, waveHeights.slice(0, 32))}</g><g fill="${amber}">${waveform(80 + 22 * 10, 300, 22, waveHeights.slice(10, 27))}</g><rect x="840" y="150" width="120" height="200" rx="60" fill="${cream}"/><g fill="none" stroke="${cream}" stroke-width="14" stroke-linecap="round"><path d="M800 270 v20 a100 100 0 0 0 200 0 v-20"/><line x1="900" y1="390" x2="900" y2="460"/><line x1="850" y1="460" x2="950" y2="460"/></g><g stroke="${ink}" stroke-width="6"><line x1="860" y1="200" x2="940" y2="200"/><line x1="860" y1="230" x2="940" y2="230"/><line x1="860" y1="260" x2="940" y2="260"/></g>`,
  ),
  "longwave-waveform": wide(
    ink,
    `<line x1="40" y1="300" x2="1160" y2="300" stroke="${slate}" stroke-width="2"/><g fill="${cream}" opacity="0.92">${waveform(70, 300, 24, waveHeights)}</g><rect x="574" y="70" width="4" height="460" fill="${amber}"/><circle cx="576" cy="70" r="12" fill="${amber}"/>`,
  ),
  "longwave-microphone": square(
    deep,
    `<circle cx="300" cy="300" r="230" fill="${ink}"/><rect x="230" y="110" width="140" height="240" rx="70" fill="${cream}"/><g stroke="${deep}" stroke-width="7"><line x1="246" y1="170" x2="354" y2="170"/><line x1="240" y1="205" x2="360" y2="205"/><line x1="240" y1="240" x2="360" y2="240"/><line x1="240" y1="275" x2="360" y2="275"/></g><g fill="none" stroke="${amber}" stroke-width="16" stroke-linecap="round"><path d="M190 280 v20 a110 110 0 0 0 220 0 v-20"/><line x1="300" y1="410" x2="300" y2="480"/><line x1="240" y1="480" x2="360" y2="480"/></g>`,
  ),
  "longwave-host-ffion": square(
    paper,
    `<circle cx="300" cy="300" r="250" fill="${cream}"/><path d="M110 600 C120 440 210 390 300 390 C390 390 480 440 490 600Z" fill="${slate}"/><rect x="268" y="330" width="64" height="70" fill="#c99b7a"/><path d="M196 250 C190 130 260 96 312 100 C384 104 420 160 410 260 C420 330 400 380 388 400 L372 300 L228 300 L214 400 C196 370 190 320 196 250Z" fill="${ink}"/><ellipse cx="300" cy="262" rx="88" ry="104" fill="#d8ab88"/><path d="M212 230 C232 160 300 150 392 200 C380 150 340 120 300 122 C240 124 210 170 212 230Z" fill="${ink}"/><path d="M196 262 a104 104 0 0 1 208 0" fill="none" stroke="${amber}" stroke-width="14" stroke-linecap="round"/><rect x="180" y="248" width="34" height="62" rx="14" fill="${amber}"/><rect x="386" y="248" width="34" height="62" rx="14" fill="${amber}"/><path d="M276 314 q24 14 48 0" fill="none" stroke="#8a5a40" stroke-width="5" stroke-linecap="round"/>`,
  ),
  "longwave-host-dev": square(
    paper,
    `<circle cx="300" cy="300" r="250" fill="${cream}"/><path d="M100 600 C110 450 200 396 300 396 C400 396 490 450 500 600Z" fill="${amber}"/><path d="M250 396 L300 470 L350 396Z" fill="${cream}"/><rect x="266" y="334" width="68" height="70" fill="#7b5236"/><ellipse cx="300" cy="258" rx="90" ry="106" fill="#8d5f3f"/><path d="M206 236 C200 150 250 120 300 120 C356 120 404 150 396 236 C384 196 350 176 300 176 C252 176 218 196 206 236Z" fill="${ink}"/><path d="M226 300 C240 360 270 374 300 374 C330 374 360 360 374 300 C350 330 330 338 300 338 C270 338 250 330 226 300Z" fill="${ink}"/><g fill="none" stroke="${ink}" stroke-width="6"><circle cx="262" cy="258" r="26"/><circle cx="340" cy="258" r="26"/><line x1="288" y1="258" x2="314" y2="258"/></g>`,
  ),
  "longwave-clock": square(
    ink,
    `<circle cx="300" cy="300" r="200" fill="${deep}" stroke="${cream}" stroke-width="4"/><g stroke="${cream}" stroke-width="6" stroke-linecap="round">${clockMarks()}</g><g stroke-linecap="round"><line x1="300" y1="300" x2="300" y2="168" stroke="${cream}" stroke-width="12"/><line x1="300" y1="300" x2="390" y2="352" stroke="${amber}" stroke-width="12"/></g><circle cx="300" cy="300" r="14" fill="${amber}"/><g fill="none" stroke="${slate}" stroke-width="4"><circle cx="490" cy="500" r="44"/><circle cx="490" cy="500" r="22"/></g>`,
  ),
  "longwave-wheel": square(
    deep,
    `<circle cx="300" cy="300" r="210" fill="none" stroke="${ink}" stroke-width="44"/><circle cx="300" cy="300" r="182" fill="none" stroke="${slate}" stroke-width="8"/><g stroke="${cream}" stroke-width="4" opacity="0.8">${spokes()}</g><circle cx="300" cy="300" r="46" fill="${amber}"/><circle cx="300" cy="300" r="16" fill="${ink}"/><rect x="60" y="540" width="480" height="10" rx="5" fill="${slate}"/>`,
  ),
  "longwave-window": square(
    paper,
    `<rect x="150" y="70" width="300" height="460" fill="${ink}"/><rect x="170" y="90" width="260" height="200" fill="${slate}"/><rect x="170" y="310" width="260" height="200" fill="${deep}"/><g stroke="${cream}" stroke-width="10"><line x1="300" y1="90" x2="300" y2="290"/><line x1="170" y1="190" x2="430" y2="190"/><line x1="300" y1="310" x2="300" y2="510"/><line x1="170" y1="410" x2="430" y2="410"/></g><rect x="150" y="286" width="300" height="28" fill="${amber}"/><rect x="120" y="530" width="360" height="22" fill="${slate}"/><circle cx="380" cy="140" r="26" fill="${amber}" opacity="0.85"/>`,
  ),
  "longwave-cello": square(
    ink,
    `<rect x="290" y="40" width="20" height="210" rx="6" fill="${slate}"/><path d="M300 210 C230 210 200 250 214 300 C224 336 196 346 196 400 C196 480 246 540 300 540 C354 540 404 480 404 400 C404 346 376 336 386 300 C400 250 370 210 300 210Z" fill="${amber}"/><path d="M262 330 c-14 30 14 50 0 80 M338 330 c14 30 -14 50 0 80" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><g stroke="${cream}" stroke-width="2"><line x1="294" y1="60" x2="294" y2="470"/><line x1="299" y1="60" x2="299" y2="470"/><line x1="304" y1="60" x2="304" y2="470"/><line x1="309" y1="60" x2="309" y2="470"/></g><rect x="264" y="440" width="72" height="12" rx="4" fill="${ink}"/><path d="M110 120 H180 M110 160 H160" stroke="${slate}" stroke-width="8" stroke-linecap="round"/>`,
  ),
  "longwave-kettle": square(
    cream,
    `<rect x="0" y="470" width="600" height="130" fill="${paper}"/><path d="M170 470 C150 360 190 250 300 250 C410 250 450 360 430 470Z" fill="${ink}"/><path d="M230 250 C230 170 370 170 370 250" fill="none" stroke="${slate}" stroke-width="22" stroke-linecap="round"/><path d="M168 340 L96 270 L120 252 L196 312Z" fill="${ink}"/><rect x="270" y="226" width="60" height="30" rx="10" fill="${amber}"/><path d="M200 400 H400" stroke="${amber}" stroke-width="10"/><path d="M96 230 q-20 -34 0 -66 M130 214 q-20 -34 0 -66" fill="none" stroke="${slate}" stroke-width="7" stroke-linecap="round"/>`,
  ),
  "longwave-needle": square(
    slate,
    `<g fill="none" stroke="${cream}" stroke-width="4">${darning()}</g><rect x="120" y="150" width="360" height="290" fill="none" stroke="${ink}" stroke-width="10" stroke-dasharray="22 14"/><line x1="470" y1="90" x2="250" y2="350" stroke="${amber}" stroke-width="10" stroke-linecap="round"/><path d="M462 100 C540 140 520 260 430 300 C360 330 330 420 380 520" fill="none" stroke="${amber}" stroke-width="4"/>`,
  ),
};
