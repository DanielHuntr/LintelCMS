// Writes sample-orbit.riv: Lintel's own small Rive sample, so the Rive element shows
// something before a site has a file of its own. A green circle breathes while a small dot
// circles it; a "Hover" state machine with a "hover" switch makes both quicker and bigger.
//
// The file is written field by field in Rive's published runtime format (a "RIVE" header,
// then each object as its type key and properties). Run: node samples/make-sample-rive.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const bytes = [];
const varUint = (value) => {
  let rest = value;
  do {
    let byte = rest & 0x7f;
    rest >>>= 7;
    if (rest) byte |= 0x80;
    bytes.push(byte);
  } while (rest);
};
const float = (value) => {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatLE(value);
  bytes.push(...buffer);
};
const colour = (argb) => {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(argb >>> 0);
  bytes.push(...buffer);
};
const text = (value) => {
  const encoded = Buffer.from(value, "utf8");
  varUint(encoded.length);
  bytes.push(...encoded);
};

// Each property is [key, kind, value]; kinds are how the runtime reads them.
const write = { uint: varUint, double: float, colour, text, bool: (on) => bytes.push(on ? 1 : 0) };
function object(typeKey, properties = []) {
  varUint(typeKey);
  for (const [key, kind, value] of properties) {
    varUint(key);
    write[kind](value);
  }
  varUint(0);
}

const type = {
  backboard: 23,
  artboard: 1,
  node: 2,
  shape: 3,
  ellipse: 4,
  fill: 20,
  solidColour: 18,
  linearAnimation: 31,
  keyedObject: 25,
  keyedProperty: 26,
  keyFrameDouble: 30,
  stateMachine: 53,
  stateMachineBool: 59,
  stateMachineLayer: 57,
  entryState: 63,
  anyState: 62,
  exitState: 64,
  animationState: 61,
  stateTransition: 65,
  boolCondition: 71,
};
const key = {
  name: 4,
  parentId: 5,
  width: 7,
  height: 8,
  x: 13,
  y: 14,
  rotation: 15,
  scaleX: 16,
  scaleY: 17,
  pathWidth: 20,
  pathHeight: 21,
  colourValue: 37,
  animationName: 55,
  fps: 56,
  duration: 57,
  loop: 59,
  objectId: 51,
  propertyKey: 53,
  frame: 67,
  interpolation: 68,
  value: 70,
  componentName: 138,
  boolValue: 141,
  animationId: 149,
  stateTo: 151,
  transitionDuration: 158,
  inputId: 155,
  op: 156,
};

// Header: fingerprint, version 7.0, file id, and an empty table of extra properties.
bytes.push(..."RIVE".split("").map((letter) => letter.charCodeAt(0)));
varUint(7);
varUint(0);
varUint(0);
varUint(0);

object(type.backboard);
// Index 0 in the artboard.
object(type.artboard, [
  [key.name, "text", "Orbit"],
  [key.width, "double", 200],
  [key.height, "double", 200],
]);
// 1-4: the circle.
object(type.shape, [
  [key.name, "text", "Circle"],
  [key.parentId, "uint", 0],
  [key.x, "double", 100],
  [key.y, "double", 100],
]);
object(type.ellipse, [
  [key.parentId, "uint", 1],
  [key.pathWidth, "double", 110],
  [key.pathHeight, "double", 110],
]);
object(type.fill, [[key.parentId, "uint", 1]]);
object(type.solidColour, [
  [key.parentId, "uint", 3],
  [key.colourValue, "colour", 0xff2f6f4e],
]);
// 5: the orbit, turning; 6-9: the dot on it.
object(type.node, [
  [key.name, "text", "Orbit"],
  [key.parentId, "uint", 0],
  [key.x, "double", 100],
  [key.y, "double", 100],
]);
object(type.shape, [
  [key.name, "text", "Dot"],
  [key.parentId, "uint", 5],
  [key.x, "double", 78],
  [key.y, "double", 0],
]);
object(type.ellipse, [
  [key.parentId, "uint", 6],
  [key.pathWidth, "double", 22],
  [key.pathHeight, "double", 22],
]);
object(type.fill, [[key.parentId, "uint", 6]]);
object(type.solidColour, [
  [key.parentId, "uint", 8],
  [key.colourValue, "colour", 0xffe0a458],
]);

const linear = 1;
/** Keyframes for one property: a list of [frame, value]. */
function keyed(objectId, propertyKeys, frames) {
  object(type.keyedObject, [[key.objectId, "uint", objectId]]);
  for (const propertyKey of propertyKeys) {
    object(type.keyedProperty, [[key.propertyKey, "uint", propertyKey]]);
    for (const [frame, value] of frames) {
      object(type.keyFrameDouble, [
        [key.frame, "uint", frame],
        [key.interpolation, "uint", linear],
        [key.value, "double", value],
      ]);
    }
  }
}
/** A gentle in-and-out swell, sampled finely enough to look smooth. */
function swell(length, from, to, steps = 12) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const progress = index / steps;
    return [
      Math.round(progress * length),
      from + ((to - from) * (1 - Math.cos(progress * Math.PI * 2))) / 2,
    ];
  });
}
const turn = (length) => [
  [0, 0],
  [length, Math.PI * 2],
];

// Animation 0: Idle, four seconds.
object(type.linearAnimation, [
  [key.animationName, "text", "Idle"],
  [key.fps, "uint", 60],
  [key.duration, "uint", 240],
  [key.loop, "uint", 1],
]);
keyed(1, [key.scaleX, key.scaleY], swell(240, 1, 1.06));
keyed(5, [key.rotation], turn(240));

// Animation 1: Quick, quicker and a little bigger. Not called Hover: playing a name picks an
// animation before a state machine.
object(type.linearAnimation, [
  [key.animationName, "text", "Quick"],
  [key.fps, "uint", 60],
  [key.duration, "uint", 90],
  [key.loop, "uint", 1],
]);
keyed(1, [key.scaleX, key.scaleY], swell(90, 1.12, 1.18));
keyed(5, [key.rotation], turn(90));

// The state machine: Entry goes to Idle; "hover" on goes to Hover and off goes back.
object(type.stateMachine, [[key.animationName, "text", "Hover"]]);
object(type.stateMachineBool, [
  [key.componentName, "text", "hover"],
  [key.boolValue, "bool", false],
]);
object(type.stateMachineLayer, [[key.componentName, "text", "Layer"]]);
const states = { entry: 0, any: 1, exit: 2, idle: 3, hover: 4 };
const equal = 0;
const notEqual = 1;
object(type.entryState);
object(type.stateTransition, [[key.stateTo, "uint", states.idle]]);
object(type.anyState);
object(type.exitState);
object(type.animationState, [[key.animationId, "uint", 0]]);
object(type.stateTransition, [
  [key.stateTo, "uint", states.hover],
  [key.transitionDuration, "uint", 300],
]);
object(type.boolCondition, [
  [key.inputId, "uint", 0],
  [key.op, "uint", equal],
]);
object(type.animationState, [[key.animationId, "uint", 1]]);
object(type.stateTransition, [
  [key.stateTo, "uint", states.idle],
  [key.transitionDuration, "uint", 300],
]);
object(type.boolCondition, [
  [key.inputId, "uint", 0],
  [key.op, "uint", notEqual],
]);

const file = fileURLToPath(new URL("./sample-orbit.riv", import.meta.url));
writeFileSync(file, Buffer.from(bytes));
process.stdout.write(`Wrote ${file} (${bytes.length} bytes)
`);
