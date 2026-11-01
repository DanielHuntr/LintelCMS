import { z } from "zod";
import { imageAddressSchema } from "../components/component-props.js";

/**
 * A muted, looping video behind a section's content, such as a slow shot of the sea. It is
 * decoration, so screen readers skip it; it never plays for people who ask for less motion,
 * and a Pause button on the video lets anyone stop it. Until it plays (or if it never does)
 * the poster picture shows.
 *
 * The colour overlay sits between the video and the content, to keep text readable.
 */
export interface BackgroundVideo {
  src: string;
  assetId: string | null;
  poster: string;
  /** A colour such as `rgb(0 0 0 / 0.4)`; empty for none. */
  overlay: string;
}

export const videoAddressSchema = imageAddressSchema.refine((address) => address !== "", {
  error: "Choose a video for the background",
});

export const backgroundVideoSchema = z.object({
  src: videoAddressSchema,
  assetId: z.string().max(100).nullable().default(null),
  poster: imageAddressSchema.default(""),
  overlay: z
    .string()
    .max(80)
    .regex(/^[\w\s#%().,\-/]*$/, { error: "The overlay should be a colour" })
    .default(""),
});

/** The containers a background video can go behind. */
export const backgroundVideoTypes: readonly string[] = ["section", "box", "container"];
