import type { PageDocument } from "@lintel/builder-model";

/** A/B tests as the API returns them (see packages/core/src/experiments). */

export type VersionKey = "original" | "b" | "c";
export type ChallengerKey = "b" | "c";
export type ExperimentStatus = "draft" | "running" | "stopped" | "ended";

export type ExperimentGoal =
  | { kind: "form" }
  | { kind: "order" }
  | { kind: "click"; target: string; label?: string }
  | { kind: "page"; entryId: string };

export interface ExperimentVersion {
  key: ChallengerKey;
  /** The whole page, or for a section test a page holding just that section. */
  design: PageDocument;
  updatedAt: string;
}

export interface Experiment {
  id: string;
  entryId: string;
  pageTitle: string;
  collection: string;
  scope: "page" | "section";
  sectionId: string | null;
  status: ExperimentStatus;
  goal: ExperimentGoal | null;
  split: number[];
  winner: VersionKey | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  versions: ExperimentVersion[];
}

export type Verdict =
  "noData" | "aheadTooEarly" | "behindTooEarly" | "tooClose" | "better" | "worse";

export interface VersionResult {
  key: VersionKey;
  share: number;
  visitors: number;
  conversions: number;
  rate: number;
  comparison: {
    rate: number;
    originalRate: number;
    relativeDifference: number | null;
    probabilityBetter: number;
    verdict: Verdict;
    sureness: number;
  } | null;
}

export interface ExperimentResults {
  enoughData: boolean;
  minimumVisitors: number;
  minimumConversions: number;
  versions: VersionResult[];
}
