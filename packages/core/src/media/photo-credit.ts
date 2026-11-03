import { z } from "zod";

/**
 * Where a file's credit came from, kept beside the credit text when Lintel wrote it (free
 * photos do): the licence's code and name, its link, the creator, and the page the file was
 * found on. A credit typed by hand has none of this; it is shown as typed.
 */
export const creditDetailsSchema = z.object({
  /** "cc0", "pdm", "by", "by-sa"... as Openverse names them. */
  licence: z.string(),
  /** "CC BY 2.0". */
  licenceName: z.string(),
  licenceUrl: z.string().nullable(),
  creator: z.string(),
  /** The page where the file was found, such as its Flickr page. */
  sourceUrl: z.string().nullable(),
});

export type CreditDetails = z.infer<typeof creditDetailsSchema>;

/**
 * The credit a website shows under a picture: either the parts, so the creator can link to
 * the source and the licence to its terms, or (for a credit typed by hand) just `text`.
 * Shared with the site's components, which draw it (see @lintel/site-components).
 */
export const photoCreditSchema = z.object({
  /** The whole credit as stored; what is shown when there are no parts. */
  text: z.string(),
  creator: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  licenceName: z.string().nullable(),
  licenceUrl: z.string().nullable(),
});

export type PhotoCredit = z.infer<typeof photoCreditSchema>;

/** Licences that ask for nothing: the photo may be used without saying who made it. */
const LICENCES_WITHOUT_ATTRIBUTION = ["cc0", "pdm"];

/**
 * What to show under a picture, or null when nothing should be. A file without a credit
 * shows nothing, and so does a CC0 or Public Domain Mark photo. Any other credit is shown:
 * one Lintel wrote, in parts; one typed by hand, as typed.
 */
export function photoCreditFor(asset: {
  credit: string;
  creditDetails: CreditDetails | null;
}): PhotoCredit | null {
  const text = asset.credit.trim();
  if (!text) return null;
  const details = asset.creditDetails;
  if (!details) {
    return { text, creator: null, sourceUrl: null, licenceName: null, licenceUrl: null };
  }
  if (LICENCES_WITHOUT_ATTRIBUTION.includes(details.licence.toLowerCase())) return null;
  return {
    text,
    creator: details.creator || null,
    sourceUrl: details.sourceUrl,
    licenceName: details.licenceName || null,
    licenceUrl: details.licenceUrl,
  };
}
