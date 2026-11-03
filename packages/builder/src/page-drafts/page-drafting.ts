import type { DraftPlan, DraftSectionKind } from "@lintel/builder-model";
import { createContext, useContext } from "react";

export const draftTones = ["friendly", "professional", "playful", "calm"] as const;
export type DraftTone = (typeof draftTones)[number];

export const rewriteStyles = ["shorter", "friendlier", "more-formal"] as const;
export type RewriteStyle = (typeof rewriteStyles)[number];

export interface DraftPageRequest {
  purpose: string;
  audience: string;
  tone: DraftTone;
  /** Empty: the model chooses. */
  sections: DraftSectionKind[];
}

/** How a draft is followed while it's written: a way to stop it, and how far it has got. */
export interface DraftWatch {
  signal: AbortSignal;
  /** From 0 to 1. */
  onProgress: (fraction: number) => void;
}

/**
 * Page drafting, as the app provides it: the builder never talks to the server itself. The
 * admin passes this while the Page drafting plugin is on and the person has `drafts:use`;
 * without it, neither "Draft a page for me" nor "Rewrite this" is shown.
 */
export interface PageDrafting {
  /** The writing model is installed, so drafts can be written. */
  isReady: boolean;
  /** Resolves with the checked plan; rejects (with a readable message) or on Stop. */
  draftPage: (request: DraftPageRequest, watch: DraftWatch) => Promise<DraftPlan>;
  rewrite: (request: { text: string; style: RewriteStyle }, watch: DraftWatch) => Promise<string>;
}

export const PageDraftingContext = createContext<PageDrafting | undefined>(undefined);

export function usePageDrafting(): PageDrafting | undefined {
  return useContext(PageDraftingContext);
}
