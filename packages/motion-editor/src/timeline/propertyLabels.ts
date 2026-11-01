import {
  catalogueProperties,
  isCssVariable,
  type AnimatableProperty,
  type CatalogueProperty,
} from "@lintel/motion";
import type { MotionEditorStringKey } from "../strings/motionEditorStrings.js";
import { useTranslate } from "../strings/translate.js";

/** Each property's name in plain words, e.g. translateY is "Move down". */
export const propertyLabelKeys = Object.fromEntries(
  catalogueProperties.map((property) => [property, `motionEditor.property.${property}`]),
) as Record<CatalogueProperty, MotionEditorStringKey>;

export function usePropertyLabel(property: AnimatableProperty): string {
  const t = useTranslate();
  return isCssVariable(property)
    ? t("motionEditor.property.variable", { name: property })
    : t(propertyLabelKeys[property]);
}
