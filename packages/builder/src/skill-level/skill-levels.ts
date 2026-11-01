/**
 * How much of the builder someone sees. Beginners get the essentials, so nothing on screen
 * is there to confuse; Designers add every style setting and the animation timeline;
 * Developers add the code tools, for people with the `builder:code` permission.
 */

export const skillLevels = ["beginner", "designer", "developer"] as const;
export type SkillLevel = (typeof skillLevels)[number];

export interface SkillLevelTools {
  /** The Style panel's Advanced view, with hover and focus styles. */
  advancedStyles: boolean;
  /** The animation timeline (the studio's Advanced view). */
  animationTimeline: boolean;
  /** The Code panel, code blocks and pasting HTML as code. */
  codeTools: boolean;
}

export function toolsFor(level: SkillLevel, canEditCode: boolean): SkillLevelTools {
  return {
    advancedStyles: level !== "beginner",
    animationTimeline: level !== "beginner",
    codeTools: level === "developer" && canEditCode,
  };
}

/** A stored level, or Beginner. Developer falls back to Designer without the permission. */
export function readSkillLevel(stored: string | null, canEditCode: boolean): SkillLevel {
  const level = skillLevels.find((candidate) => candidate === stored) ?? "beginner";
  return level === "developer" && !canEditCode ? "designer" : level;
}
