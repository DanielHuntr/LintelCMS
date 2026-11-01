import {
  colourTokens,
  type DesignToken,
  findTokenByValue,
  radiusTokens,
  spacingTokens,
  type StylePropertyName,
} from "@lintel/builder-model";
import type { Translate } from "../i18n/builder-text.js";

/**
 * What a closed style section says is set inside it, in a few words: "Row · gap M",
 * "Huge · Bold", "Brand". Empty when nothing is set, so a closed section stays quiet.
 */

export type ReadStyle = (property: StylePropertyName) => string | undefined;

/** The shadows Effects offers, by name, so a summary can say "Soft shadow". */
export const shadows = {
  soft: "0 1px 2px rgb(0 0 0 / 0.06), 0 4px 12px rgb(0 0 0 / 0.06)",
  medium: "0 2px 4px rgb(0 0 0 / 0.06), 0 12px 32px rgb(0 0 0 / 0.1)",
  strong: "0 4px 8px rgb(0 0 0 / 0.1), 0 24px 56px rgb(0 0 0 / 0.18)",
} as const;

export const fontSizeChoices = {
  "0.875rem": "pageBuilder.style.sizeSmall",
  "1.25rem": "pageBuilder.style.sizeLarge",
  "2rem": "pageBuilder.style.sizeHuge",
  "3.5rem": "pageBuilder.style.sizeGiant",
} as const;

function join(parts: ReadonlyArray<string | undefined | false>): string {
  const sentence = parts.filter(Boolean).join(" · ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** A token's name ("M", "Brand") or the value as written ("24px"). */
function named(value: string | undefined, tokens: readonly DesignToken[]): string | undefined {
  if (!value) return undefined;
  return findTokenByValue(value, tokens)?.label ?? value;
}

function firstSet(read: ReadStyle, properties: readonly StylePropertyName[]) {
  return properties.map(read).find((value) => value !== undefined && value !== "0");
}

export function layoutSummary(read: ReadStyle, text: Translate): string {
  const display = read("display");
  const gap = named(read("gap"), spacingTokens);
  const columns = /^repeat\((\d+)/.exec(read("gridTemplateColumns") ?? "")?.[1];
  const arrangement =
    display === "grid"
      ? join([
          text("pageBuilder.style.grid"),
          columns && text("pageBuilder.style.summary.columns", { count: columns }),
        ])
      : display === "flex"
        ? text(
            read("flexDirection") === "row" ? "pageBuilder.style.row" : "pageBuilder.style.stack",
          )
        : undefined;
  if (!arrangement) return "";
  return join([
    arrangement,
    gap && gap !== "0" && text("pageBuilder.style.summary.gap", { size: gap }),
  ]);
}

export function spacingSummary(read: ReadStyle, text: Translate): string {
  const inside = named(
    firstSet(read, ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]),
    spacingTokens,
  );
  const outside = named(
    firstSet(read, ["marginTop", "marginRight", "marginBottom", "marginLeft"]),
    spacingTokens,
  );
  return join([
    inside && text("pageBuilder.style.summary.inside", { size: inside }),
    outside && text("pageBuilder.style.summary.outside", { size: outside }),
  ]);
}

export function sizeSummary(read: ReadStyle, text: Translate): string {
  const width = read("width");
  const height = read("height");
  const widest = read("maxWidth");
  return join([
    width && text("pageBuilder.style.summary.width", { size: width }),
    height && text("pageBuilder.style.summary.height", { size: height }),
    widest && text("pageBuilder.style.summary.widest", { size: widest }),
  ]);
}

const weights: Record<string, Parameters<Translate>[0]> = {
  "500": "pageBuilder.style.weightMedium",
  "600": "pageBuilder.style.weightBold",
  "700": "pageBuilder.style.weightBold",
};
const alignments: Record<string, Parameters<Translate>[0]> = {
  center: "pageBuilder.style.alignCentreText",
  right: "pageBuilder.style.alignRight",
  justify: "pageBuilder.style.alignJustify",
};

export function textSummary(read: ReadStyle, text: Translate): string {
  const size = read("fontSize");
  const sizeKey = size ? fontSizeChoices[size as keyof typeof fontSizeChoices] : undefined;
  const weight = weights[read("fontWeight") ?? ""];
  const align = alignments[read("textAlign") ?? ""];
  return join([
    sizeKey ? text(sizeKey) : size,
    weight && text(weight),
    align && text(align),
    named(read("color"), colourTokens),
  ]);
}

export function backgroundSummary(read: ReadStyle): string {
  return join([named(read("backgroundColor"), colourTokens)]);
}

export function bordersSummary(read: ReadStyle, text: Translate): string {
  const radius = read("borderRadius");
  const corners =
    radius === "999px"
      ? text("pageBuilder.style.cornersRound")
      : radius === "0"
        ? undefined
        : named(radius, radiusTokens);
  const width = read("borderWidth");
  return join([
    corners && text("pageBuilder.style.summary.corners", { size: corners }),
    width && width !== "0" && text("pageBuilder.style.summary.border", { width }),
  ]);
}

const positions: Record<string, Parameters<Translate>[0]> = {
  relative: "pageBuilder.style.positionRelative",
  absolute: "pageBuilder.style.positionAbsolute",
  sticky: "pageBuilder.style.positionSticky",
  fixed: "pageBuilder.style.positionFixed",
};

export function positionSummary(read: ReadStyle, text: Translate): string {
  const position = positions[read("position") ?? ""];
  return position ? text(position) : "";
}

export function effectsSummary(read: ReadStyle, text: Translate): string {
  const opacity = Number(read("opacity") ?? 1);
  const shadow = read("boxShadow");
  const shadowName =
    shadow === shadows.soft
      ? text("pageBuilder.style.shadowSoft")
      : shadow === shadows.medium
        ? text("pageBuilder.style.shadowMedium")
        : shadow === shadows.strong
          ? text("pageBuilder.style.shadowStrong")
          : shadow
            ? text("pageBuilder.style.summary.custom")
            : undefined;
  return join([
    Number.isFinite(opacity) &&
      opacity < 1 &&
      text("pageBuilder.style.summary.seeThrough", { percent: Math.round((1 - opacity) * 100) }),
    shadowName && text("pageBuilder.style.summary.shadow", { size: shadowName.toLowerCase() }),
  ]);
}
