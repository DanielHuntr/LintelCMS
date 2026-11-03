/**
 * The Relay starter site's pictures: flat, two-colour drawings of a crew-scheduling app (its
 * week board, a shift on a phone, a day's route) in ink and one signal green on pale paper,
 * standing in for screenshots until people add their own.
 */

const paper = "#eceae3";
const card = "#f8f7f3";
const line = "#c9c6bc";
const grey = "#8d8f89";
const ink = "#17191a";
const green = "#1f7a4d";
const mint = "#cfe1d4";

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480" role="img"><rect width="640" height="480" fill="${background}"/>${body}</svg>`;

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

/** The week board: five days across, a row per person, shifts as bars, two of them green. */
function weekBoard(x: number, y: number, width: number): string {
  const rowHeight = 46;
  const dayWidth = (width - 90) / 5;
  const shifts: [number, number, number, boolean][] = [
    [0, 0, 2, false],
    [0, 3, 2, false],
    [1, 1, 3, true],
    [2, 0, 1, false],
    [2, 2, 2, false],
    [3, 3, 2, true],
    [4, 0, 3, false],
    [4, 4, 1, false],
  ];
  const parts: string[] = [
    `<rect x="${x}" y="${y}" width="${width}" height="${rowHeight * 5 + 52}" rx="10" fill="${card}" stroke="${line}" stroke-width="2"/>`,
  ];
  for (let day = 0; day < 5; day += 1) {
    const left = x + 90 + day * dayWidth;
    parts.push(
      `<rect x="${left + 10}" y="${y + 18}" width="${dayWidth * 0.4}" height="8" rx="4" fill="${grey}"/>`,
      `<line x1="${left}" y1="${y + 40}" x2="${left}" y2="${y + 40 + rowHeight * 5}" stroke="${line}" stroke-width="1.5"/>`,
    );
  }
  for (let row = 0; row < 5; row += 1) {
    const top = y + 44 + row * rowHeight;
    parts.push(
      `<circle cx="${x + 30}" cy="${top + rowHeight / 2 - 4}" r="11" fill="${row === 1 || row === 3 ? green : ink}"/>`,
      `<rect x="${x + 48}" y="${top + rowHeight / 2 - 8}" width="28" height="7" rx="3.5" fill="${grey}"/>`,
    );
  }
  for (const [row, start, length, isGreen] of shifts) {
    const top = y + 44 + row * rowHeight + 6;
    parts.push(
      `<rect x="${x + 90 + start * dayWidth + 6}" y="${top}" width="${length * dayWidth - 12}" height="${rowHeight - 20}" rx="6" fill="${isGreen ? green : ink}"/>`,
    );
  }
  return parts.join("");
}

/** The crew: five people in a row, one of them picked out in green. */
function crew(): string {
  return [0, 1, 2, 3, 4]
    .map((index) => {
      const x = 96 + index * 112;
      const fill = index === 2 ? green : ink;
      return `<circle cx="${x}" cy="190" r="34" fill="${fill}"/><path d="M${x - 48} 300 a48 52 0 0 1 96 0 Z" fill="${fill}"/><rect x="${x - 40}" y="326" width="80" height="12" rx="6" fill="${grey}"/><rect x="${x - 28}" y="348" width="56" height="10" rx="5" fill="${line}"/>`;
    })
    .join("");
}

export const relayIllustrations: Record<string, string> = {
  "relay-cover": landscape(
    paper,
    `${weekBoard(56, 104, 528)}<rect x="56" y="52" width="140" height="18" rx="9" fill="${ink}"/><rect x="452" y="46" width="132" height="30" rx="15" fill="${green}"/>`,
  ),
  "relay-board": landscape(
    paper,
    `${weekBoard(40, 60, 560)}<rect x="40" y="396" width="190" height="10" rx="5" fill="${grey}"/><rect x="40" y="418" width="120" height="10" rx="5" fill="${line}"/>`,
  ),
  "relay-phone": portrait(
    mint,
    `<rect x="120" y="60" width="240" height="480" rx="36" fill="${ink}"/><rect x="134" y="74" width="212" height="452" rx="26" fill="${card}"/><rect x="200" y="88" width="80" height="10" rx="5" fill="${ink}"/><rect x="156" y="130" width="96" height="10" rx="5" fill="${grey}"/><rect x="156" y="152" width="150" height="18" rx="9" fill="${ink}"/><rect x="156" y="200" width="168" height="150" rx="14" fill="${paper}" stroke="${line}" stroke-width="2"/><rect x="174" y="222" width="70" height="8" rx="4" fill="${grey}"/><rect x="174" y="242" width="120" height="14" rx="7" fill="${ink}"/><rect x="174" y="268" width="96" height="8" rx="4" fill="${grey}"/><rect x="174" y="306" width="132" height="28" rx="14" fill="${green}"/><path d="M226 320 l8 8 l16 -16" fill="none" stroke="${card}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="156" y="372" width="168" height="56" rx="14" fill="${paper}" stroke="${line}" stroke-width="2"/><rect x="174" y="390" width="100" height="8" rx="4" fill="${grey}"/><rect x="174" y="406" width="64" height="8" rx="4" fill="${line}"/><rect x="156" y="444" width="168" height="56" rx="14" fill="${paper}" stroke="${line}" stroke-width="2"/><rect x="174" y="462" width="80" height="8" rx="4" fill="${grey}"/><rect x="174" y="478" width="110" height="8" rx="4" fill="${line}"/>`,
  ),
  "relay-route": landscape(
    paper,
    `<path d="M0 120 H640 M0 260 H640 M0 380 H640 M140 0 V480 M330 0 V480 M500 0 V480" stroke="${line}" stroke-width="14"/><path d="M90 400 C150 300 220 330 260 250 S380 120 450 170 S540 260 560 90" fill="none" stroke="${ink}" stroke-width="5" stroke-dasharray="2 12" stroke-linecap="round"/><circle cx="90" cy="400" r="16" fill="${ink}"/><circle cx="260" cy="250" r="14" fill="${card}" stroke="${ink}" stroke-width="5"/><circle cx="450" cy="170" r="14" fill="${card}" stroke="${ink}" stroke-width="5"/><circle cx="560" cy="90" r="22" fill="${green}"/><circle cx="560" cy="90" r="8" fill="${card}"/>`,
  ),
  "relay-swap": landscape(
    mint,
    `<rect x="80" y="120" width="480" height="84" rx="14" fill="${card}"/><circle cx="130" cy="162" r="22" fill="${ink}"/><rect x="170" y="148" width="150" height="12" rx="6" fill="${ink}"/><rect x="170" y="168" width="96" height="10" rx="5" fill="${grey}"/><rect x="430" y="146" width="100" height="32" rx="8" fill="${ink}"/><rect x="80" y="276" width="480" height="84" rx="14" fill="${card}"/><circle cx="130" cy="318" r="22" fill="${green}"/><rect x="170" y="304" width="130" height="12" rx="6" fill="${ink}"/><rect x="170" y="324" width="110" height="10" rx="5" fill="${grey}"/><rect x="430" y="302" width="100" height="32" rx="8" fill="${green}"/><path d="M356 214 C390 230 390 250 356 266" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><path d="M346 254 l10 12 l14 -6" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  "relay-crew": landscape(
    paper,
    `<rect x="40" y="96" width="560" height="4" fill="${line}"/>${crew()}`,
  ),
};
