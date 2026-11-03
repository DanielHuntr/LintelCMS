/**
 * Easing a value towards a moving target, the same at any frame rate: `smoothing` is how
 * much of the gap remains after 1/60 s (0 jumps straight there, 0.9 trails softly).
 */
export function approach(
  current: number,
  target: number,
  smoothing: number,
  elapsedMilliseconds: number,
): number {
  const remaining = Math.pow(
    Math.min(Math.max(smoothing, 0), 0.999),
    elapsedMilliseconds / (1000 / 60),
  );
  const next = target + (current - target) * remaining;
  return Math.abs(next - target) < 0.001 ? target : next;
}

export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/**
 * A spring stepped by hand, for values that follow a moving target (a dragged card, a
 * letter pushed by the pointer). Semi-implicit Euler in small steps, so it stays stable
 * when a frame is late.
 */
export interface SpringState {
  value: number;
  velocity: number;
}

export function stepSpring(
  state: SpringState,
  target: number,
  { stiffness = 170, damping = 26, mass = 1 } = {},
  elapsedMilliseconds = 16,
): SpringState {
  let { value, velocity } = state;
  let remaining = elapsedMilliseconds / 1000;
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 120);
    const force = -stiffness * (value - target) - damping * velocity;
    velocity += (force / mass) * step;
    value += velocity * step;
    remaining -= step;
  }
  return { value, velocity };
}

export function springIsAtRest(state: SpringState, target: number): boolean {
  return Math.abs(state.value - target) < 0.01 && Math.abs(state.velocity) < 0.01;
}
