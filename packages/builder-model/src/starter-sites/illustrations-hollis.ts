/**
 * The Hollis starter site's pictures: soft plaster pink with rosewood and near-black, in big
 * rounded shapes like the salon's arched mirrors. The four team portraits share one frame
 * so they line up; people replace them with their own photos.
 */

const plaster = "#ecd9d0";
const blush = "#e2c3b6";
const rose = "#9c3d54";
const ink = "#2a1f1d";
const cream = "#f7efe9";
const skin = ["#d9a98c", "#a9714f", "#7a4b33", "#e8c2a6"];

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

/** A head and shoulders in an arch, with the hair drawn over the top. */
function teamPortrait(tone: string, hair: string, top: string): string {
  return portrait(
    plaster,
    `<path d="M60 600V240a180 180 0 0 1 360 0V600Z" fill="${blush}"/><path d="M110 600c0-110 60-150 130-150s130 40 130 150Z" fill="${ink}"/><rect x="214" y="370" width="52" height="90" rx="24" fill="${tone}"/><ellipse cx="240" cy="300" rx="78" ry="96" fill="${tone}"/>${hair}<path d="M110 600c20-70 70-100 130-100s110 30 130 100" fill="none" stroke="${top}" stroke-width="18"/>`,
  );
}

export const hollisIllustrations: Record<string, string> = {
  // An arched mirror over a salon chair, the cover of the template card.
  "hollis-cover": landscape(
    plaster,
    `<path d="M210 330V150a90 90 0 0 1 180 0V330Z" fill="${cream}" stroke="${ink}" stroke-width="6"/><path d="M240 170a60 60 0 0 1 60-50" fill="none" stroke="${blush}" stroke-width="10" stroke-linecap="round"/><rect x="230" y="300" width="140" height="70" rx="35" fill="${rose}"/><rect x="250" y="250" width="100" height="70" rx="30" fill="${rose}"/><path d="M300 370V410M260 410H340" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><circle cx="470" cy="110" r="40" fill="${blush}"/><path d="M90 410c0-60 10-120 30-150M120 410c0-50-10-90-30-120" stroke="${ink}" stroke-width="4" fill="none"/>`,
  ),
  // The arched mirror alone, a plant reflected in it.
  "hollis-mirror": portrait(
    blush,
    `<path d="M100 520V230a140 140 0 0 1 280 0V520Z" fill="${cream}" stroke="${ink}" stroke-width="8"/><path d="M150 230a90 90 0 0 1 70-80" fill="none" stroke="${plaster}" stroke-width="16" stroke-linecap="round"/><path d="M300 520c0-90 10-160 40-220M300 520c-10-70-40-120-80-150M300 400c30-20 60-20 80-10" stroke="${rose}" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="342" cy="296" rx="20" ry="34" fill="${rose}" transform="rotate(30 342 296)"/><ellipse cx="222" cy="366" rx="18" ry="32" fill="${rose}" transform="rotate(-50 222 366)"/><path d="M60 560H420" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`,
  ),
  // Scissors open across a comb.
  "hollis-scissors": landscape(
    cream,
    `<rect x="110" y="290" width="380" height="36" rx="10" fill="${ink}"/><path d="M130 290v-24M150 290v-24M170 290v-24M190 290v-24M210 290v-24M230 290v-24M250 290v-24M270 290v-24M290 290v-24M310 290v-24M330 290v-24M350 290v-24M370 290v-24M390 290v-24M410 290v-24M430 290v-24M450 290v-24M470 290v-24" stroke="${ink}" stroke-width="6"/><path d="M200 120L420 240M200 240L420 120" stroke="${rose}" stroke-width="12" stroke-linecap="round"/><circle cx="170" cy="105" r="32" fill="none" stroke="${rose}" stroke-width="12"/><circle cx="170" cy="255" r="32" fill="none" stroke="${rose}" stroke-width="12"/><circle cx="310" cy="180" r="7" fill="${ink}"/>`,
  ),
  // A shelf of bottles and jars.
  "hollis-shelf": landscape(
    plaster,
    `<path d="M70 340H530" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><rect x="110" y="200" width="60" height="140" rx="12" fill="${rose}"/><rect x="128" y="170" width="24" height="34" fill="${ink}"/><rect x="200" y="240" width="80" height="100" rx="40" fill="${cream}"/><rect x="214" y="222" width="52" height="22" rx="6" fill="${ink}"/><rect x="310" y="180" width="44" height="160" rx="20" fill="${ink}"/><path d="M322 180v-30h20v30" fill="${ink}"/><rect x="384" y="260" width="90" height="80" rx="10" fill="${blush}" stroke="${ink}" stroke-width="4"/><path d="M400 290h58" stroke="${ink}" stroke-width="4"/>`,
  ),
  // The team: four people, four haircuts.
  "hollis-team-ana": teamPortrait(
    skin[0] ?? plaster,
    `<path d="M150 300c-10-110 40-160 90-160s100 50 90 160c-10-40-30-80-90-80s-80 40-90 80Z" fill="${ink}"/><path d="M160 300c0 40 0 80-10 110h40c-10-30-20-70-30-110ZM320 300c0 40 0 80 10 110h-40c10-30 20-70 30-110Z" fill="${ink}"/>`,
    rose,
  ),
  "hollis-team-kofi": teamPortrait(
    skin[2] ?? plaster,
    `<path d="M162 270c0-70 34-104 78-104s78 34 78 104c-20-30-50-40-78-40s-58 10-78 40Z" fill="${ink}"/>`,
    cream,
  ),
  "hollis-team-mei": teamPortrait(
    skin[3] ?? plaster,
    `<circle cx="240" cy="148" r="46" fill="${ink}"/><path d="M160 290c0-80 36-120 80-120s80 40 80 120c-14-44-44-70-80-70s-66 26-80 70Z" fill="${ink}"/>`,
    blush,
  ),
  "hollis-team-jo": teamPortrait(
    skin[1] ?? plaster,
    `<circle cx="180" cy="210" r="40" fill="${rose}"/><circle cx="230" cy="180" r="44" fill="${rose}"/><circle cx="290" cy="190" r="42" fill="${rose}"/><circle cx="320" cy="240" r="36" fill="${rose}"/><circle cx="160" cy="260" r="32" fill="${rose}"/>`,
    ink,
  ),
};
