import type { MotionSpec } from "@lintel/motion";

declare global {
  interface Window {
    /** Every spec the studio has reported through onChange, oldest first. */
    studioChanges: MotionSpec[];
    openStudio: (presetId: string) => void;
  }
}

export {};
