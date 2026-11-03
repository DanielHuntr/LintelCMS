import { z } from "zod";

/**
 * The A/B testing plugin's settings (the `plugin:experiments` setting, see src/plugins).
 *
 * - `countOnlyAfterConsent`: the pages' counting script keeps one first-party localStorage
 *   key holding only a test id and a version letter, so by default it doesn't wait for
 *   consent (docs/decisions/0051-visitors-tests-and-the-cookie-notice.md). Sites that want
 *   every visitor to agree first turn this on: the cookie notice then lists "A/B test
 *   counts", and nothing is stored or sent until a visitor allows "plugin:experiments".
 *   Which version a visitor sees is chosen on the server either way.
 */
export const experimentsSettingsSchema = z.object({
  countOnlyAfterConsent: z.boolean(),
});

export type ExperimentsSettings = z.infer<typeof experimentsSettingsSchema>;

export const defaultExperimentsSettings: ExperimentsSettings = {
  countOnlyAfterConsent: false,
};
