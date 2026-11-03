import { SiteMotionSettings } from "@lintel/motion-editor";
import type { ComponentProps } from "react";
import { useCursorColourSwatches } from "./cursor-colours.js";

/** Motion across the site, offering the site's own colours for the cursor's word. */
export function SiteMotionSettingsWithColours(
  props: Omit<ComponentProps<typeof SiteMotionSettings>, "colours">,
) {
  return <SiteMotionSettings {...props} colours={useCursorColourSwatches()} />;
}
