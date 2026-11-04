/**
 * How sure we can be that one version of a page converts better than another, by the
 * Bayesian beta-binomial method: each version's true conversion rate is unknown, with a flat
 * prior (any rate equally likely), so after `visitors` visits and `conversions` conversions
 * it is Beta(1 + conversions, 1 + visitors - conversions). The chance that B's rate is higher
 * than the original's is worked out exactly (Evan Miller's sum, with log-gamma for big
 * numbers), or by the normal approximation once the sum would be very long. It reads as
 * people expect: "about 96% sure B is better". See docs/decisions/0044-ab-testing.md.
 */

export interface VersionCounts {
  visitors: number;
  conversions: number;
}

/** Below these, a result is called too early whatever it says. */
export const MINIMUM_VISITORS_PER_VERSION = 100;
export const MINIMUM_CONVERSIONS = 20;
/** How sure a result must be before it is called better (or worse). */
export const CONFIDENT_PROBABILITY = 0.95;

export type Verdict =
  "noData" | "aheadTooEarly" | "behindTooEarly" | "tooClose" | "better" | "worse";

export interface Comparison {
  /** Conversions per visitor for the challenger, 0 to 1. */
  rate: number;
  /** The original's rate, 0 to 1. */
  originalRate: number;
  /** The change against the original's rate: 0.25 is 25% more. Null when the original has none. */
  relativeDifference: number | null;
  /** The chance the challenger's true rate is higher, 0 to 1. */
  probabilityBetter: number;
  verdict: Verdict;
  /** How sure the verdict is, in whole percent, for "about 96% sure". */
  sureness: number;
}

/** Conversions per visitor, 0 when there are no visitors. */
export function conversionRate(counts: VersionCounts): number {
  return counts.visitors > 0 ? Math.min(1, counts.conversions / counts.visitors) : 0;
}

/** Whether a test has enough visitors and conversions for its verdict to count. */
export function hasEnoughData(versions: readonly VersionCounts[]): boolean {
  const conversions = versions.reduce((sum, version) => sum + version.conversions, 0);
  return (
    versions.every((version) => version.visitors >= MINIMUM_VISITORS_PER_VERSION) &&
    conversions >= MINIMUM_CONVERSIONS
  );
}

export function compareWithOriginal(
  original: VersionCounts,
  challenger: VersionCounts,
  enoughData: boolean,
): Comparison {
  const originalRate = conversionRate(original);
  const rate = conversionRate(challenger);
  const probabilityBetter = probabilityBIsBetter(original, challenger);
  const relativeDifference = originalRate > 0 ? (rate - originalRate) / originalRate : null;
  const verdict = chooseVerdict(original, challenger, probabilityBetter, enoughData);
  const sureness = Math.floor(
    100 *
      (verdict === "worse" || verdict === "behindTooEarly"
        ? 1 - probabilityBetter
        : probabilityBetter),
  );
  return { rate, originalRate, relativeDifference, probabilityBetter, verdict, sureness };
}

function chooseVerdict(
  original: VersionCounts,
  challenger: VersionCounts,
  probabilityBetter: number,
  enoughData: boolean,
): Verdict {
  if (original.visitors === 0 || challenger.visitors === 0) return "noData";
  // Fewer visitors would read as a lead, with nobody having succeeded on either side.
  if (original.conversions === 0 && challenger.conversions === 0) return "tooClose";
  if (enoughData && probabilityBetter >= CONFIDENT_PROBABILITY) return "better";
  if (enoughData && probabilityBetter <= 1 - CONFIDENT_PROBABILITY) return "worse";
  if (Math.abs(probabilityBetter - 0.5) < 0.05) return "tooClose";
  return probabilityBetter > 0.5 ? "aheadTooEarly" : "behindTooEarly";
}

/** Above this many conversions the exact sum is long, and the normal approximation is close. */
const EXACT_SUM_LIMIT = 5000;

/** P(rate B > rate A), with Beta(1 + conversions, 1 + misses) for each. */
export function probabilityBIsBetter(a: VersionCounts, b: VersionCounts): number {
  const alphaA = 1 + a.conversions;
  const betaA = 1 + Math.max(0, a.visitors - a.conversions);
  const alphaB = 1 + b.conversions;
  const betaB = 1 + Math.max(0, b.visitors - b.conversions);
  if (alphaB > EXACT_SUM_LIMIT) return normalApproximation(alphaA, betaA, alphaB, betaB);
  let total = 0;
  for (let index = 0; index < alphaB; index += 1) {
    total += Math.exp(
      logBeta(alphaA + index, betaA + betaB) -
        Math.log(betaB + index) -
        logBeta(1 + index, betaB) -
        logBeta(alphaA, betaA),
    );
  }
  return Math.min(1, Math.max(0, total));
}

function normalApproximation(alphaA: number, betaA: number, alphaB: number, betaB: number) {
  const mean = (alpha: number, beta: number) => alpha / (alpha + beta);
  const variance = (alpha: number, beta: number) =>
    (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const difference = mean(alphaB, betaB) - mean(alphaA, betaA);
  const spread = Math.sqrt(variance(alphaA, betaA) + variance(alphaB, betaB));
  return standardNormalBelow(difference / spread);
}

function logBeta(x: number, y: number): number {
  return logGamma(x) + logGamma(y) - logGamma(x + y);
}

/** ln Γ(x) for x > 0, by the Lanczos approximation (about 15 correct digits). */
const lanczos = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const shifted = x - 1;
  let sum = 0.99999999999980993;
  for (const [index, coefficient] of lanczos.entries()) sum += coefficient / (shifted + index + 1);
  const t = shifted + lanczos.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

/** Φ(z): the chance a standard normal value is below z (Abramowitz and Stegun 7.1.26). */
function standardNormalBelow(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial =
    t *
    (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const errorFunction = 1 - polynomial * Math.exp(-x * x);
  return z >= 0 ? (1 + errorFunction) / 2 : (1 - errorFunction) / 2;
}
