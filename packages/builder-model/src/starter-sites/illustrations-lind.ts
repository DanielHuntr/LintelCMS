/**
 * The Lind starter site's pictures: one object to a frame, flat black and off-white with a
 * signal yellow, like the shop's own price tags. Portrait frames (4:5), so they sit in a
 * lookbook or a product grid until the shop's own photos replace them.
 */

const paper = "#ecebe5";
const stone = "#d7d5cc";
const ink = "#151515";
const yellow = "#f2c230";
const white = "#fbfaf6";

const portrait = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 600" role="img"><rect width="480" height="600" fill="${background}"/>${body}</svg>`;

const landscape = (background: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" role="img"><rect width="600" height="450" fill="${background}"/>${body}</svg>`;

/** The floor the object stands on, with its shadow. */
const floor = (y: number, width: number) =>
  `<rect x="0" y="${y}" width="480" height="${600 - y}" fill="${stone}"/><ellipse cx="240" cy="${y}" rx="${width}" ry="14" fill="${ink}" opacity="0.18"/>`;

export const lindIllustrations: Record<string, string> = {
  // Shelves of the shop's things: the template card.
  "lind-cover": landscape(
    yellow,
    `<path d="M60 190H540M60 340H540" stroke="${ink}" stroke-width="8"/><rect x="100" y="110" width="60" height="80" rx="4" fill="${ink}"/><path d="M160 130h18a14 14 0 0 1 0 28h-18" fill="none" stroke="${ink}" stroke-width="8"/><path d="M230 190c-20-40-10-90 20-100c30 10 40 60 20 100Z" fill="${white}" stroke="${ink}" stroke-width="5"/><rect x="330" y="96" width="70" height="94" fill="${white}" stroke="${ink}" stroke-width="5"/><path d="M342 120h46M342 140h46M342 160h30" stroke="${ink}" stroke-width="4"/><circle cx="470" cy="160" r="30" fill="${ink}"/><rect x="110" y="270" width="140" height="70" rx="6" fill="${ink}"/><path d="M110 296h140" stroke="${yellow}" stroke-width="6"/><path d="M320 340V250h20v90M360 340V230h20v110M400 340V260h20v80" fill="${white}" stroke="${ink}" stroke-width="5"/><path d="M470 340l-30-80h60Z" fill="${white}" stroke="${ink}" stroke-width="5"/>`,
  ),
  // A stoneware mug with a yellow glaze inside.
  "lind-mug": portrait(
    paper,
    `${floor(430, 120)}<rect x="140" y="230" width="180" height="200" rx="18" fill="${ink}"/><path d="M320 270h30a40 40 0 0 1 0 80h-30" fill="none" stroke="${ink}" stroke-width="22"/><ellipse cx="230" cy="232" rx="90" ry="16" fill="${yellow}"/><path d="M200 190c-14-20 14-30 0-56M250 196c-14-20 14-30 0-56" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round" opacity="0.5"/>`,
  ),
  // A tall vase with one branch.
  "lind-vase": portrait(
    yellow,
    `${floor(470, 90)}<path d="M200 470c-40-60-40-140 0-200v-50h80v50c40 60 40 140 0 200Z" fill="${white}" stroke="${ink}" stroke-width="6"/><path d="M240 220V90M240 160l50-40M240 130l-40-40" stroke="${ink}" stroke-width="5" stroke-linecap="round"/><circle cx="292" cy="118" r="12" fill="${ink}"/><circle cx="198" cy="88" r="12" fill="${ink}"/><circle cx="240" cy="84" r="10" fill="${ink}"/>`,
  ),
  // Notebooks in a stack, the top one yellow.
  "lind-notebooks": portrait(
    paper,
    `${floor(460, 150)}<rect x="100" y="400" width="280" height="60" fill="${ink}"/><rect x="110" y="350" width="270" height="50" fill="${white}" stroke="${ink}" stroke-width="5"/><rect x="96" y="290" width="280" height="60" fill="${yellow}" stroke="${ink}" stroke-width="5"/><path d="M130 290v60" stroke="${ink}" stroke-width="5"/><path d="M330 290v-60" stroke="${ink}" stroke-width="5"/><path d="M330 230l12 16l12-16" fill="none" stroke="${ink}" stroke-width="5"/><path d="M118 375h240" stroke="${ink}" stroke-width="2" opacity="0.5"/>`,
  ),
  // A mushroom-shaped table lamp, switched on.
  "lind-lamp": portrait(
    ink,
    `<rect x="0" y="470" width="480" height="130" fill="#262626"/><ellipse cx="240" cy="470" rx="90" ry="12" fill="${yellow}" opacity="0.25"/><path d="M120 250a120 110 0 0 1 240 0Z" fill="${yellow}"/><rect x="226" y="250" width="28" height="200" fill="${white}"/><rect x="170" y="450" width="140" height="20" rx="10" fill="${white}"/><path d="M60 280l-30 10M420 280l30 10M100 330l-24 22M380 330l24 22" stroke="${yellow}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`,
  ),
  // A wool throw, folded, with a stripe.
  "lind-throw": portrait(
    paper,
    `${floor(450, 150)}<rect x="90" y="300" width="300" height="150" rx="18" fill="${white}" stroke="${ink}" stroke-width="6"/><path d="M90 350h300M90 400h300" stroke="${ink}" stroke-width="4"/><rect x="90" y="360" width="300" height="28" fill="${yellow}"/><path d="M110 450v24M140 450v24M170 450v24M200 450v24M230 450v24M260 450v24M290 450v24M320 450v24M350 450v24" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`,
  ),
  // A candle in a black holder.
  "lind-candle": portrait(
    yellow,
    `${floor(470, 100)}<path d="M160 470h160l-20-60H180Z" fill="${ink}"/><rect x="214" y="190" width="52" height="220" fill="${white}" stroke="${ink}" stroke-width="5"/><path d="M240 190v-20" stroke="${ink}" stroke-width="4"/><path d="M240 168c-18-24 0-50 0-70c0 20 18 46 0 70Z" fill="${ink}"/>`,
  ),
  // The shop front on a corner: the about picture.
  "lind-shopfront": landscape(
    paper,
    `<rect x="80" y="90" width="440" height="300" fill="${white}" stroke="${ink}" stroke-width="6"/><rect x="80" y="90" width="440" height="60" fill="${ink}"/><text x="300" y="132" font-family="Helvetica, Arial, sans-serif" font-size="34" font-weight="700" letter-spacing="10" text-anchor="middle" fill="${yellow}">LIND</text><rect x="110" y="180" width="230" height="180" fill="${yellow}" stroke="${ink}" stroke-width="5"/><path d="M150 360v-60h40v60M220 360v-90h40v90M290 360v-40h30v40" fill="${white}" stroke="${ink}" stroke-width="4"/><rect x="380" y="180" width="110" height="210" fill="${stone}" stroke="${ink}" stroke-width="5"/><circle cx="470" cy="290" r="6" fill="${ink}"/><path d="M40 390H560" stroke="${ink}" stroke-width="6"/>`,
  ),
};
