import { z } from "zod";
import { optionalSetting } from "../config-values.js";

/**
 * The secret a cron job sends to POST /system/run-scheduled-jobs. Leave it out and Lintel
 * makes one and keeps it in `cron-secret.txt` in its data folder; `lintel cron --print-line`
 * prints the line to paste into the host's cron jobs screen either way.
 */
export const schedulerSettings = {
  CRON_SECRET: optionalSetting(
    z
      .string()
      .trim()
      .min(24, { error: "Should be at least 24 characters, so it can't be guessed" }),
  ),
};
