/**
 * The Northside starter site's pictures: friendly, rounded shapes in harbour teal, warm
 * paper and a soft orange, like a hand-printed community poster. People replace them with
 * photos of their own volunteers and events (with everyone's permission).
 */

const paper = "#f3ead9";
const teal = "#1f6b6a";
const mist = "#cfe3df";
const orange = "#e08a4f";
const ink = "#1f2a2e";
const cream = "#fffaf0";

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

/** A row of terraced houses, each a slightly different height and door colour. */
function terrace(y: number): string {
  const doors = [teal, orange, ink, teal, orange];
  return doors
    .map((door, index) => {
      const x = 40 + index * 106;
      const top = y - 150 - (index % 2) * 20;
      return `<rect x="${x}" y="${top}" width="100" height="${y - top}" fill="${cream}" stroke="${ink}" stroke-width="4"/><path d="M${x - 4} ${top}h108" stroke="${ink}" stroke-width="8"/><rect x="${x + 18}" y="${top + 26}" width="24" height="32" fill="${mist}" stroke="${ink}" stroke-width="3"/><rect x="${x + 58}" y="${top + 26}" width="24" height="32" fill="${mist}" stroke="${ink}" stroke-width="3"/><path d="M${x + 36} ${y}v-46a14 14 0 0 1 28 0v46" fill="${door}" stroke="${ink}" stroke-width="3"/>`;
    })
    .join("");
}

export const northsideIllustrations: Record<string, string> = {
  // A terrace of houses with a garden bed in front: the template card.
  "northside-cover": landscape(
    mist,
    `<circle cx="500" cy="80" r="40" fill="${orange}"/>${terrace(340)}<rect x="0" y="340" width="600" height="110" fill="${teal}"/><path d="M60 340c0-30 20-40 30-60M110 340c0-30-20-40-30-60M300 340c0-40 30-50 40-70M350 340c0-30-20-50-30-70" stroke="${cream}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  ),
  // The street, by day.
  "northside-street": landscape(
    paper,
    `<circle cx="520" cy="80" r="36" fill="${orange}"/>${terrace(370)}<path d="M0 370H600" stroke="${ink}" stroke-width="5"/><path d="M0 400h80M140 400h80M280 400h80M420 400h80" stroke="${ink}" stroke-width="4" opacity="0.4"/>`,
  ),
  // Raised beds and a watering can.
  "northside-garden": landscape(
    paper,
    `<rect x="60" y="270" width="220" height="80" rx="10" fill="${teal}"/><rect x="320" y="270" width="220" height="80" rx="10" fill="${teal}"/><path d="M100 270c0-50 20-70 30-90M150 270c0-40-10-60-30-80M210 270c0-60 30-80 40-100M380 270c0-40 10-60 30-80M440 270c0-50-20-70-30-90M500 270c0-30 10-50 20-60" stroke="${ink}" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="130" cy="176" r="14" fill="${orange}"/><circle cx="250" cy="170" r="14" fill="${orange}"/><circle cx="410" cy="184" r="12" fill="${orange}"/><path d="M380 400h120a10 10 0 0 0 10-10v-50H370v50a10 10 0 0 0 10 10Z" fill="${orange}"/><path d="M510 350l50-40" stroke="${orange}" stroke-width="12" stroke-linecap="round"/><path d="M390 340a50 30 0 0 1 100 0" fill="none" stroke="${ink}" stroke-width="6"/><path d="M0 400H600" stroke="${ink}" stroke-width="4"/>`,
  ),
  // The larder: shelves of jars and tins.
  "northside-larder": portrait(
    mist,
    `<rect x="60" y="80" width="360" height="460" fill="${cream}" stroke="${ink}" stroke-width="5"/><path d="M60 220H420M60 360H420" stroke="${ink}" stroke-width="6"/><rect x="90" y="140" width="50" height="80" rx="8" fill="${orange}"/><rect x="90" y="132" width="50" height="14" fill="${ink}"/><rect x="160" y="150" width="50" height="70" rx="8" fill="${teal}"/><rect x="230" y="120" width="60" height="100" fill="${paper}" stroke="${ink}" stroke-width="4"/><rect x="310" y="160" width="80" height="60" rx="30" fill="${orange}"/><rect x="90" y="300" width="60" height="60" rx="6" fill="${teal}"/><rect x="170" y="300" width="60" height="60" rx="6" fill="${teal}"/><rect x="250" y="270" width="140" height="90" fill="${paper}" stroke="${ink}" stroke-width="4"/><path d="M270 300h100M270 320h70" stroke="${ink}" stroke-width="4"/><rect x="100" y="430" width="120" height="110" fill="${orange}"/><path d="M100 460h120" stroke="${cream}" stroke-width="6"/><rect x="260" y="450" width="120" height="90" fill="${teal}"/>`,
  ),
  // A long table with a teapot and mugs: the Thursday lunch.
  "northside-lunch": landscape(
    orange,
    `<rect x="60" y="270" width="480" height="24" rx="8" fill="${ink}"/><path d="M100 294v110M500 294v110" stroke="${ink}" stroke-width="10"/><path d="M250 270c-30 0-40-30-40-60s20-50 60-50s60 20 60 50s-10 60-40 60Z" fill="${teal}"/><path d="M330 200c30 0 30 40 0 40" fill="none" stroke="${teal}" stroke-width="10"/><path d="M210 210l-30-20" stroke="${teal}" stroke-width="10" stroke-linecap="round"/><circle cx="270" cy="152" r="10" fill="${ink}"/><rect x="120" y="226" width="44" height="44" rx="8" fill="${cream}"/><rect x="380" y="226" width="44" height="44" rx="8" fill="${cream}"/><rect x="450" y="226" width="44" height="44" rx="8" fill="${mist}"/><path d="M140 210c-10-14 10-20 0-36M400 210c-10-14 10-20 0-36" stroke="${cream}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  ),
  // A bicycle up on a stand, being fixed.
  "northside-bikes": landscape(
    mist,
    `<circle cx="190" cy="270" r="80" fill="none" stroke="${ink}" stroke-width="10"/><circle cx="410" cy="270" r="80" fill="none" stroke="${ink}" stroke-width="10"/><path d="M190 270L270 170H380L410 270M270 170L300 270H410M300 270L260 140M240 140h50M380 170l-10-40h40" fill="none" stroke="${teal}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M300 270l40 140M300 270l-40 140" stroke="${orange}" stroke-width="10" stroke-linecap="round"/><path d="M80 410H520" stroke="${ink}" stroke-width="5"/>`,
  ),
  // The community hall with its doors open.
  "northside-hall": landscape(
    paper,
    `<path d="M120 380V190L300 100L480 190V380Z" fill="${cream}" stroke="${ink}" stroke-width="5"/><circle cx="300" cy="170" r="26" fill="${mist}" stroke="${ink}" stroke-width="4"/><path d="M250 380V280a50 50 0 0 1 100 0V380" fill="${orange}" stroke="${ink}" stroke-width="4"/><path d="M300 240V380" stroke="${ink}" stroke-width="3"/><rect x="160" y="250" width="50" height="70" fill="${mist}" stroke="${ink}" stroke-width="4"/><rect x="390" y="250" width="50" height="70" fill="${mist}" stroke="${ink}" stroke-width="4"/><path d="M40 380H560" stroke="${ink}" stroke-width="5"/><path d="M60 380c0-40 30-60 40-90M520 380c0-40-30-60-40-90" stroke="${teal}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  ),
};
