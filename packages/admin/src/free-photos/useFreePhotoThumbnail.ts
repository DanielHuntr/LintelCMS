import { useQuery } from "@tanstack/react-query";
import { loadThumbnail } from "./freePhotos.api.js";

/**
 * A free photo's small picture. It comes through Lintel's API with the session cookie, so
 * it is fetched and shown as a data: URL rather than given straight to an <img> (a data:
 * URL needs no tidying up afterwards, unlike a blob: URL).
 * `isMissing` is true when there is none: Openverse no longer has the photo, so the result
 * isn't worth showing (it couldn't be added either).
 */
export function useFreePhotoThumbnail(photoId: string): { url?: string; isMissing: boolean } {
  const thumbnail = useQuery({
    queryKey: ["free-photos", "thumbnail", photoId],
    queryFn: async () => readAsDataUrl(await loadThumbnail(photoId)),
    staleTime: Infinity,
    retry: false,
  });
  return { url: thumbnail.data, isMissing: thumbnail.isError };
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unreadable")));
    reader.readAsDataURL(blob);
  });
}
