import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";
import { describeVideoAddress } from "./video-addresses.js";

/** A video from YouTube, Vimeo or a file, and an icon from the admin's icon set. */

export const videoFieldtype = defineFieldtype({
  type: "video",
  name: "Video",
  description: "A YouTube or Vimeo video, or a link to a video file, shown with a player.",
  category: "media",
  keywords: ["youtube", "vimeo", "embed", "movie", "clip", "mp4"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be the address of a video` })
      .trim()
      .refine((address) => describeVideoAddress(address) !== null, {
        error: `${label} should be a YouTube or Vimeo address, or an https:// link to a video file`,
      }),
});

/** Icon names as the admin's icon set spells them: "map-pin", "calendar". */
const ICON_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const iconFieldtype = defineFieldtype({
  type: "icon",
  name: "Icon",
  description: "A small symbol picked from a set, such as a pin for an address.",
  category: "media",
  keywords: ["symbol", "glyph", "emoji", "pictogram", "lucide"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be the name of an icon` })
      .max(64, { error: `${label} should be the name of an icon` })
      .regex(ICON_NAME_PATTERN, { error: `${label} should be the name of an icon, like map-pin` }),
});
