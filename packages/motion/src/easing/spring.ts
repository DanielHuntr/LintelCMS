import type { SpringEasing } from "../spec/easing.schema.js";

/**
 * A spring, as a damped harmonic oscillator that starts still at 0 and settles at 1.
 *
 * A spring has no fixed length: it settles when it settles. Lintel stretches the spring's
 * motion over the keyframe segment it eases, and the editor shows the spring's natural
 * settling time so the animation's duration can be set to match.
 */

type SpringPhysics = Pick<SpringEasing, "stiffness" | "damping" | "mass">;

/** Position at `seconds` after release. Closed-form, so sampling is cheap and exact. */
export function springPosition({ stiffness, damping, mass }: SpringPhysics, seconds: number) {
  const naturalFrequency = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  if (dampingRatio < 1) {
    const dampedFrequency = naturalFrequency * Math.sqrt(1 - dampingRatio * dampingRatio);
    const decay = Math.exp(-dampingRatio * naturalFrequency * seconds);
    return (
      1 -
      decay *
        (Math.cos(dampedFrequency * seconds) +
          ((dampingRatio * naturalFrequency) / dampedFrequency) *
            Math.sin(dampedFrequency * seconds))
    );
  }
  if (dampingRatio === 1) {
    return 1 - Math.exp(-naturalFrequency * seconds) * (1 + naturalFrequency * seconds);
  }
  const root = Math.sqrt(dampingRatio * dampingRatio - 1);
  const fastRate = -naturalFrequency * (dampingRatio + root);
  const slowRate = -naturalFrequency * (dampingRatio - root);
  const fastShare = -slowRate / (fastRate - slowRate);
  const slowShare = fastRate / (fastRate - slowRate);
  return 1 - (fastShare * Math.exp(fastRate * seconds) + slowShare * Math.exp(slowRate * seconds));
}

const settledWithin = 0.001;
const sampleStep = 1 / 240;
const longestSpring = 10;

/** How long the spring takes to come to rest, in milliseconds. */
export function springSettleDuration(spring: SpringPhysics): number {
  let lastUnsettled = 0;
  for (let seconds = 0; seconds <= longestSpring; seconds += sampleStep) {
    if (Math.abs(springPosition(spring, seconds) - 1) > settledWithin) lastUnsettled = seconds;
  }
  return Math.round(Math.min(lastUnsettled + sampleStep, longestSpring) * 1000);
}

/** The spring as an easing: progress through the segment (0 to 1) in, position out. */
export function evaluateSpring(spring: SpringPhysics, time: number, settleMilliseconds?: number) {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  const settleSeconds = (settleMilliseconds ?? springSettleDuration(spring)) / 1000;
  return springPosition(spring, time * settleSeconds);
}
