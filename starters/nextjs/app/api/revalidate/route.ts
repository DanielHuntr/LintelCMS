import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { ALL_CONTENT_TAG, collectionTag } from "../../../lib/lintel";

/**
 * Refreshes content straight away instead of within the minute, for example from a deploy
 * script or, later, a Lintel webhook:
 *
 *   curl -X POST -H "authorization: Bearer $REVALIDATE_SECRET" \
 *     "http://localhost:3000/api/revalidate?collection=posts"
 *
 * Without `collection`, everything from Lintel is refreshed. Set REVALIDATE_SECRET in
 * .env.local; without it this route is switched off, so strangers can't use it.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ message: "Set REVALIDATE_SECRET to use this route." }, { status: 404 });
  }
  if (!isSameSecret(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ message: "The secret is missing or wrong." }, { status: 401 });
  }

  const collection = new URL(request.url).searchParams.get("collection");
  const tag = collection ? collectionTag(collection) : ALL_CONTENT_TAG;
  // "max" serves the old page once more while the new one is made, so nobody waits.
  revalidateTag(tag, "max");
  return Response.json({ revalidated: tag });
}

/** Compared in constant time, so the secret can't be guessed from how long a reply takes. */
function isSameSecret(given: string, expected: string): boolean {
  const givenBytes = Buffer.from(given);
  const expectedBytes = Buffer.from(expected);
  return givenBytes.length === expectedBytes.length && timingSafeEqual(givenBytes, expectedBytes);
}
