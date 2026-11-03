/**
 * A small physics world for "Let visitors drag and throw these": boxes in a box, with
 * gravity, air drag, bouncy walls and boxes that push each other apart. Boxes never rotate
 * for collisions (their tilt is only a look), which keeps it short, stable and cheap
 * enough for a phone. Pure maths, no DOM: the playground effect draws what it works out.
 */

export interface PlaygroundBody {
  /** Where its top-left corner is, in the container's own pixels. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** Pixels per second. */
  velocityX: number;
  velocityY: number;
  /** Degrees; follows sideways speed, so a thrown sticker leans into its flight. */
  tilt: number;
  /** Held by the pointer: moves only where the pointer puts it, and pushes others. */
  held: boolean;
  /** Placed by the keyboard or tidied away: stays put until someone drags it. */
  pinned: boolean;
}

export interface PlaygroundWorld {
  width: number;
  height: number;
  /** Pixels per second per second; 0 floats. */
  gravity: number;
  /** How much speed a bounce keeps, 0 to 1. */
  bounce: number;
  /** How quickly moving things slow down in the air, per second. */
  drag: number;
  bodies: PlaygroundBody[];
}

export interface PlaygroundFeel {
  gravity: number;
  bounce: number;
  drag: number;
}

/** The three feels people choose from. */
export const playgroundFeels: Readonly<Record<string, PlaygroundFeel>> = {
  drift: { gravity: 0, bounce: 0.55, drag: 1.6 },
  fall: { gravity: 1400, bounce: 0.25, drag: 0.4 },
  bouncy: { gravity: 1100, bounce: 0.72, drag: 0.15 },
};

/** Faster than this, a throw is slowed to it, so nothing leaves in a blur. */
export const fastestThrow = 2800;
const restingSpeed = 24;
const solverPasses = 4;

export function createBody(
  left: number,
  top: number,
  width: number,
  height: number,
): PlaygroundBody {
  return {
    left,
    top,
    width,
    height,
    velocityX: 0,
    velocityY: 0,
    tilt: 0,
    held: false,
    pinned: false,
  };
}

const isFixed = (body: PlaygroundBody) => body.held || body.pinned;

/** Keeps a body inside the world, bouncing it off any wall it went through. */
export function keepInside(world: PlaygroundWorld, body: PlaygroundBody): void {
  const right = Math.max(0, world.width - body.width);
  const bottom = Math.max(0, world.height - body.height);
  if (body.left < 0 || body.left > right) {
    body.left = Math.min(right, Math.max(0, body.left));
    body.velocityX = -body.velocityX * world.bounce;
  }
  if (body.top < 0 || body.top > bottom) {
    const onFloor = body.top > bottom;
    body.top = Math.min(bottom, Math.max(0, body.top));
    body.velocityY = -body.velocityY * world.bounce;
    // Resting on the floor: settle rather than buzz, and slide to a stop.
    if (onFloor && Math.abs(body.velocityY) < restingSpeed * 2) body.velocityY = 0;
    if (onFloor && world.gravity > 0) body.velocityX *= 0.92;
  }
}

/** Pushes two overlapping bodies apart along the shorter overlap and trades their speed. */
export function separate(world: PlaygroundWorld, a: PlaygroundBody, b: PlaygroundBody): boolean {
  const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  if (overlapX <= 0 || overlapY <= 0) return false;
  const inverseA = isFixed(a) ? 0 : 1 / Math.max(1, a.width * a.height);
  const inverseB = isFixed(b) ? 0 : 1 / Math.max(1, b.width * b.height);
  const total = inverseA + inverseB;
  if (total === 0) return false;
  const alongX = overlapX < overlapY;
  const centre = (body: PlaygroundBody) =>
    alongX ? body.left + body.width / 2 : body.top + body.height / 2;
  const direction = centre(b) >= centre(a) ? 1 : -1;
  const overlap = alongX ? overlapX : overlapY;
  const position = alongX ? "left" : "top";
  const velocity = alongX ? "velocityX" : "velocityY";
  a[position] -= direction * overlap * (inverseA / total);
  b[position] += direction * overlap * (inverseB / total);
  // Only bodies moving towards each other trade speed.
  const closing = (b[velocity] - a[velocity]) * direction;
  if (closing < 0) {
    const impulse = (-(1 + world.bounce) * closing) / total;
    a[velocity] -= direction * impulse * inverseA;
    b[velocity] += direction * impulse * inverseB;
  }
  return true;
}

/**
 * Moves the world on by `seconds`. Returns true while anything is still moving (or held),
 * so the frame loop can rest once everything has settled.
 */
export function stepWorld(world: PlaygroundWorld, seconds: number): boolean {
  const step = Math.min(seconds, 1 / 30);
  const slowing = Math.exp(-world.drag * step);
  for (const body of world.bodies) {
    if (isFixed(body)) continue;
    body.velocityY += world.gravity * step;
    body.velocityX *= slowing;
    body.velocityY *= slowing;
    body.left += body.velocityX * step;
    body.top += body.velocityY * step;
  }
  for (let pass = 0; pass < solverPasses; pass += 1) {
    for (let first = 0; first < world.bodies.length; first += 1) {
      for (let second = first + 1; second < world.bodies.length; second += 1) {
        separate(world, world.bodies[first]!, world.bodies[second]!);
      }
    }
    for (const body of world.bodies) if (!isFixed(body)) keepInside(world, body);
  }
  let moving = false;
  for (const body of world.bodies) {
    const target = Math.max(-14, Math.min(14, body.velocityX * 0.02));
    body.tilt += (target - body.tilt) * Math.min(1, step * 8);
    if (Math.abs(body.tilt) < 0.05 && target === 0) body.tilt = 0;
    const speed = Math.hypot(body.velocityX, body.velocityY);
    if (body.held || speed > restingSpeed || Math.abs(body.tilt - target) > 0.2) moving = true;
  }
  return moving;
}

/** A throw's speed, capped so it stays readable. */
export function capThrow(velocityX: number, velocityY: number): [number, number] {
  const speed = Math.hypot(velocityX, velocityY);
  if (speed <= fastestThrow) return [velocityX, velocityY];
  const scale = fastestThrow / speed;
  return [velocityX * scale, velocityY * scale];
}
