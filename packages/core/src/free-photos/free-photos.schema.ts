import { z } from "zod";

/**
 * The licences a free photo may have to be offered at all: ones that let a business use it
 * on its website without asking anyone. "Non-commercial" (NC) and "no derivatives" (ND)
 * licences are left out: a company site is commercial, and cropping is a change.
 */
export const allowedLicences = ["cc0", "pdm", "by", "by-sa"] as const;
export type AllowedLicence = (typeof allowedLicences)[number];

/** Openverse allows anonymous searches up to 240 results deep: 12 pages of 20. */
export const PHOTOS_PER_PAGE = 20;
export const MAX_SEARCH_PAGE = 12;

/** `GET /free-photos/search?q=&page=` */
export const searchFreePhotosQuerySchema = z.object({
  q: z
    .string({ error: "Type what the photo should show" })
    .trim()
    .min(1, { error: "Type what the photo should show" })
    .max(200, { error: "Searches can be at most 200 characters" }),
  page: z.coerce
    .number({ error: "The page should be a number" })
    .int()
    .min(1)
    .max(MAX_SEARCH_PAGE, { error: `Only the first ${MAX_SEARCH_PAGE} pages can be shown` })
    .default(1),
});

/** `POST /free-photos/add`: Lintel finds the photo by its id, so only real results are fetched. */
export const addFreePhotoRequestSchema = z.object({
  id: z.uuid({ error: "That isn't a free photo's id" }),
  /** A site's handle to put it in that site's folder, or "shared" for the library. */
  folder: z.string().max(64).nullable().optional(),
});

export const freePhotoIdParamsSchema = z.object({ id: z.uuid() });

/** One search result, as the admin shows it. */
export const freePhotoSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  creator: z.string(),
  creatorUrl: z.string().nullable(),
  licence: z.enum(allowedLicences),
  /** "CC BY 4.0", "CC0 1.0", "Public Domain Mark". */
  licenceName: z.string(),
  licenceUrl: z.string().nullable(),
  /** The photo's page where it was found, such as on Flickr or Wikimedia Commons. */
  pageUrl: z.string(),
  /** Where it came from, such as "flickr" or "wikimedia". */
  source: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  /** Through Lintel's API, so the admin never contacts other services itself. */
  thumbnailUrl: z.string(),
});

export const freePhotoSearchSchema = z.object({
  photos: z.array(freePhotoSchema),
  page: z.number().int(),
  pageCount: z.number().int(),
});

export type SearchFreePhotosQuery = z.infer<typeof searchFreePhotosQuerySchema>;
export type AddFreePhotoRequest = z.infer<typeof addFreePhotoRequestSchema>;
export type FreePhoto = z.infer<typeof freePhotoSchema>;
export type FreePhotoSearch = z.infer<typeof freePhotoSearchSchema>;
