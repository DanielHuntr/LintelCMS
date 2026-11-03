// Writes sample-hop.json: Lintel's own small Lottie sample, so the Lottie element shows
// something before a site has a file of its own. Three dots hop one after another, squashing
// a little as they land. Run: node samples/make-sample-lottie.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const frames = 120;
const ground = 128;
const height = 56;
const still = (value) => ({ a: 0, k: value });
const ease = { i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } };

/** Keyframes from [frame, value] pairs, eased; the last needs no easing. */
const moving = (keys) => ({
  a: 1,
  k: keys.map(([time, value], index) =>
    index === keys.length - 1 ? { t: time, s: value } : { t: time, s: value, ...ease },
  ),
});

function dot(index, x, [red, green, blue]) {
  const start = 10 + index * 14;
  const position = moving([
    [0, [x, ground, 0]],
    [start, [x, ground, 0]],
    [start + 14, [x, ground - height, 0]],
    [start + 28, [x, ground, 0]],
    [frames, [x, ground, 0]],
  ]);
  const scale = moving([
    [0, [100, 100, 100]],
    [start, [112, 88, 100]],
    [start + 6, [92, 108, 100]],
    [start + 26, [100, 100, 100]],
    [start + 30, [114, 86, 100]],
    [start + 36, [100, 100, 100]],
    [frames, [100, 100, 100]],
  ]);
  return {
    ddd: 0,
    ind: index + 1,
    ty: 4,
    nm: `Dot ${index + 1}`,
    sr: 1,
    ks: {
      o: still(100),
      r: still(0),
      p: position,
      // Squash from the bottom of the dot, where it meets the ground.
      a: still([0, 14, 0]),
      s: scale,
    },
    ao: 0,
    shapes: [
      {
        ty: "gr",
        nm: "Dot",
        it: [
          { ty: "el", nm: "Circle", d: 1, p: still([0, 0]), s: still([28, 28]) },
          { ty: "fl", nm: "Colour", c: still([red, green, blue, 1]), o: still(100), r: 1 },
          {
            ty: "tr",
            p: still([0, 0]),
            a: still([0, 0]),
            s: still([100, 100]),
            r: still(0),
            o: still(100),
            sk: still(0),
            sa: still(0),
          },
        ],
      },
    ],
    ip: 0,
    op: frames,
    st: 0,
    bm: 0,
  };
}

const animation = {
  v: "5.7.0",
  fr: 60,
  ip: 0,
  op: frames,
  w: 200,
  h: 200,
  nm: "Hop",
  ddd: 0,
  assets: [],
  layers: [
    dot(0, 56, [0.184, 0.435, 0.306]),
    dot(1, 100, [0.878, 0.643, 0.345]),
    dot(2, 144, [0.784, 0.333, 0.239]),
  ],
};

const file = fileURLToPath(new URL("./sample-hop.json", import.meta.url));
writeFileSync(file, `${JSON.stringify(animation)}\n`);
process.stdout.write(`Wrote ${file}
`);
