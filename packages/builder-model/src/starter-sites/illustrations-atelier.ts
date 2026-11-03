/**
 * Line drawings for the Atelier starter site: a furniture workshop, the pieces it makes, how
 * they are made and where to find it. Warm paper, dark ink and one walnut tone, drawn here
 * as SVG so the site starts with artwork of its own.
 */

const paper = "#ece3d4";
const paperDeep = "#ddd0bb";
const paperLight = "#f6f0e6";
const ink = "#2e2620";
const walnut = "#9a5b34";
const pale = "#b9a88f";

const drawing = (width: number, height: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img"><rect width="${width}" height="${height}" fill="${paper}"/><g fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;

/** A floor line and a soft shadow under a piece standing at the bottom of a tall frame. */
const floor = (shadowWidth: number) =>
  `<rect y="600" width="600" height="150" fill="${paperDeep}" stroke="none"/><path d="M0 600H600"/><ellipse cx="300" cy="618" rx="${shadowWidth}" ry="12" fill="${pale}" stroke="none" opacity=".55"/>`;

const chair = `<path d="M200 445L170 610M400 445L430 610M250 455L240 630M350 455L360 630M188 545H412"/><path d="M229 425V266M263 425V243M300 425V235M337 425V243M371 425V266"/><path d="M175 430C175 170 425 170 425 430" stroke-width="5"/><ellipse cx="300" cy="430" rx="150" ry="30" fill="${walnut}"/>`;

/** Wood grain: lines that ripple across and part around a knot. */
function grain(width: number, height: number): string {
  const lines: string[] = [];
  for (let index = 0; index < 16; index += 1) {
    const y = 40 + index * ((height - 80) / 15);
    const lift = 14 + ((index * 7) % 23);
    lines.push(
      `<path d="M0 ${y} Q${width / 8} ${y - lift} ${width / 4} ${y} T${width / 2} ${y} T${(width * 3) / 4} ${y} T${width} ${y}" stroke="${index % 4 === 0 ? walnut : pale}" stroke-width="${index % 4 === 0 ? 3 : 2}"/>`,
    );
  }
  const knot = [90, 66, 44, 24]
    .map(
      (radius, index) =>
        `<ellipse cx="${width * 0.64}" cy="${height * 0.48}" rx="${radius * 1.6}" ry="${radius}" fill="${index === 0 ? paper : "none"}" stroke="${index === 3 ? walnut : pale}" stroke-width="${index === 3 ? 4 : 2}"/>`,
    )
    .join("");
  return lines.join("") + knot;
}

const chisel = (x: number, blade: number, length: number) =>
  `<rect x="${x - 11}" y="120" width="22" height="${length}" rx="10" fill="${walnut}"/><rect x="${x - 8}" y="${120 + length}" width="16" height="12" fill="${paperDeep}"/><path d="M${x - blade / 2} ${132 + length}H${x + blade / 2}V${300 + length}L${x} ${312 + length}L${x - blade / 2} ${300 + length}Z" fill="${paperLight}"/>`;

export const atelierIllustrations: Readonly<Record<string, string>> = {
  "atelier-workshop": drawing(
    1600,
    900,
    `<rect y="700" width="1600" height="200" fill="${paperDeep}" stroke="none"/><path d="M0 700H1600"/><path d="M180 620H520L840 900H400Z" fill="${paperLight}" stroke="none" opacity=".7"/><path d="M180 620V290a170 170 0 0 1 340 0V620Z" fill="${paperLight}"/><path d="M350 120V620M180 400H520M180 510H520" stroke-width="2"/><path d="M1100 0V160"/><path d="M1060 200H1140L1120 160H1080Z" fill="${walnut}"/><path d="M820 300H1380" stroke-width="4"/><path d="M862 300V318M902 300V318M942 300V318M982 300V318"/><rect x="854" y="318" width="16" height="44" rx="7" fill="${walnut}"/><rect x="894" y="318" width="16" height="52" rx="7" fill="${walnut}"/><rect x="934" y="318" width="16" height="40" rx="7" fill="${walnut}"/><rect x="974" y="318" width="16" height="48" rx="7" fill="${walnut}"/><path d="M856 362V430M898 370V444M940 358V420M978 366V436" stroke-width="5"/><path d="M1090 312H1330L1310 400H1110Z" fill="${paperLight}"/><path d="M1260 312V300H1310V312"/><path d="M800 546L780 700M840 546L860 700M1340 546L1320 700M1380 546L1400 700M790 640H1390"/><rect x="760" y="520" width="660" height="26" fill="${walnut}"/><rect x="1420" y="508" width="40" height="64" fill="${paper}"/><path d="M1000 515c-10-24 20-34 30-14s-14 24-20 8M1090 515c-6-18 16-26 22-10" stroke="${walnut}"/><path d="M1010 760c20-22 46-4 26 12s-34-6-14-22M1150 790c14-18 38-6 22 8M930 820c18-16 40-2 22 12" stroke="${walnut}"/><g transform="translate(470 380) scale(.62)">${chair}</g>`,
  ),
  "atelier-cover": drawing(
    600,
    450,
    `<rect y="360" width="600" height="90" fill="${paperDeep}" stroke="none"/><path d="M0 360H600"/><path d="M70 360V170a90 90 0 0 1 180 0V360Z" fill="${paperLight}"/><path d="M160 80V360M70 250H250" stroke-width="2"/><g transform="translate(290 110) scale(.42)">${chair}</g><path d="M310 380H560" stroke="${walnut}"/>`,
  ),
  "atelier-chair": drawing(600, 750, floor(170) + chair),
  "atelier-table": drawing(
    600,
    750,
    `${floor(230)}<path d="M150 354V560M170 354V560M430 354V560M450 354V560"/><rect x="120" y="354" width="80" height="14" fill="${paper}"/><rect x="400" y="354" width="80" height="14" fill="${paper}"/><rect x="110" y="560" width="100" height="16" fill="${walnut}"/><rect x="390" y="560" width="100" height="16" fill="${walnut}"/><rect x="170" y="430" width="260" height="14" fill="${paper}"/><rect x="70" y="330" width="460" height="24" fill="${walnut}"/><path d="M250 330a50 26 0 0 1 100 0Z" fill="${paperLight}"/>`,
  ),
  "atelier-stool": drawing(
    600,
    750,
    `${floor(140)}<path d="M220 375L170 610M380 375L430 610M300 390V630"/><ellipse cx="300" cy="520" rx="104" ry="18"/><path d="M180 360V376A120 26 0 0 0 420 376V360" fill="${walnut}"/><ellipse cx="300" cy="360" rx="120" ry="26" fill="${walnut}"/>`,
  ),
  "atelier-cabinet": drawing(
    600,
    750,
    `${floor(150)}<path d="M190 550L180 620M410 550L420 620"/><rect x="170" y="150" width="260" height="400" fill="${paperLight}"/><path d="M300 150V550"/><path d="M190 170V530M210 170V530M230 170V530M250 170V530M270 170V530M330 170V530M350 170V530M370 170V530M390 170V530M410 170V530" stroke="${pale}" stroke-width="2"/><circle cx="288" cy="350" r="6" fill="${walnut}"/><circle cx="312" cy="350" r="6" fill="${walnut}"/><rect x="160" y="138" width="280" height="12" fill="${walnut}"/>`,
  ),
  "atelier-bench": drawing(
    600,
    750,
    `${floor(240)}<path d="M110 490L90 610M150 490L165 610M450 490L435 610M490 490L510 610M100 560H500"/><rect x="60" y="470" width="480" height="20" fill="${walnut}"/><rect x="370" y="436" width="110" height="34" fill="${paperLight}"/><path d="M370 452H480"/>`,
  ),
  "atelier-timber": drawing(
    600,
    600,
    `<path d="M0 530H600"/><rect x="80" y="470" width="440" height="40" fill="${walnut}"/><rect x="120" y="450" width="20" height="20"/><rect x="290" y="450" width="20" height="20"/><rect x="460" y="450" width="20" height="20"/><rect x="80" y="410" width="440" height="40" fill="${paperLight}"/><rect x="120" y="390" width="20" height="20"/><rect x="290" y="390" width="20" height="20"/><rect x="460" y="390" width="20" height="20"/><rect x="80" y="350" width="440" height="40" fill="${walnut}"/><circle cx="210" cy="200" r="100" fill="#c79a74"/><circle cx="210" cy="200" r="74" stroke="${walnut}" stroke-width="2"/><circle cx="210" cy="200" r="50" stroke="${walnut}" stroke-width="2"/><circle cx="210" cy="200" r="26" stroke="${walnut}" stroke-width="2"/><path d="M210 200L280 150"/><path d="M360 300L470 120M400 300L500 140" stroke="${pale}"/>`,
  ),
  "atelier-joint": drawing(
    600,
    600,
    `<rect x="120" y="140" width="120" height="340" fill="${paperLight}"/><rect x="160" y="250" width="40" height="100" fill="${ink}"/><path d="M144 160V460M216 160V460" stroke="${pale}" stroke-width="2"/><rect x="330" y="270" width="200" height="60" fill="${walnut}"/><rect x="280" y="284" width="52" height="32" fill="${walnut}"/><path d="M270 300H214" stroke-dasharray="8 8"/><path d="M226 290L214 300L226 310"/>`,
  ),
  "atelier-finish": drawing(
    600,
    600,
    `<path d="M0 470H600"/><rect x="60" y="430" width="480" height="40" fill="${walnut}"/><path d="M60 450H540" stroke="${pale}" stroke-width="2"/><path d="M180 330H400L420 430H170Z" fill="${paperLight}"/><path d="M320 330C320 270 380 270 384 330" stroke-width="6"/><circle cx="220" cy="316" r="16" fill="${walnut}"/><path d="M420 420c50-6 80-60 46-84s-62 12-30 34" stroke="${walnut}" stroke-width="4"/>`,
  ),
  "atelier-grain": drawing(1600, 700, grain(1600, 700)),
  "atelier-tools": drawing(
    600,
    750,
    `<path d="M60 110H540" stroke-width="5"/>${chisel(130, 16, 110)}${chisel(220, 24, 100)}${chisel(310, 34, 116)}${chisel(400, 12, 96)}${chisel(480, 44, 106)}`,
  ),
  "atelier-showroom": drawing(
    1200,
    800,
    `<rect y="660" width="1200" height="140" fill="${paperDeep}" stroke="none"/><path d="M0 660H1200"/><path d="M220 660V230L600 90L980 230V660" fill="${paperLight}"/><path d="M500 660V400a100 100 0 0 1 200 0V660Z" fill="${walnut}"/><path d="M600 300V660M500 470H700" stroke="${paperLight}" stroke-width="3"/><path d="M290 560V360a60 60 0 0 1 120 0V560ZM790 560V360a60 60 0 0 1 120 0V560Z" fill="${paper}"/><path d="M350 300V560M290 450H410M850 300V560M790 450H910"/><path d="M470 660V680H730V660"/><rect x="540" y="230" width="120" height="30" fill="${paper}"/><path d="M80 640H180M96 640V600M164 640V600M84 600H176"/><path d="M1060 660V520M1060 520c-40-10-50-70 0-100c50 30 40 90 0 100" fill="${paperDeep}"/>`,
  ),
  "atelier-map": drawing(
    600,
    600,
    `<path d="M-20 420C120 380 180 470 300 430S470 300 620 330" stroke="#cdbfa6" stroke-width="44"/><path d="M80 0V600M0 150H600M330 0L260 600M0 250L600 280M470 0V600" stroke="${paperLight}" stroke-width="16"/><path d="M0 520L600 470" stroke="${ink}" stroke-width="3" stroke-dasharray="14 10"/><circle cx="318" cy="262" r="34" fill="${paperLight}" stroke="${walnut}" stroke-width="4"/><circle cx="318" cy="262" r="12" fill="${walnut}"/>`,
  ),
};
