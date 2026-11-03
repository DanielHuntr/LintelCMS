import { definePlugin } from "../plugins/plugin-definition.js";
import { freePhotosRoutes } from "./free-photos.routes.js";

/**
 * "Free photos": search openly licensed photos on Openverse from the media library and the
 * image picker, and add one to the library with its credit. Off until someone switches it on
 * in Build → Features, because it sends searches to another service. It has no tables of
 * its own and no permissions: it uses the media library's `media:upload`.
 */
export const freePhotosPlugin = definePlugin({
  id: "free-photos",
  name: "Free photos",
  description: "Search free-to-use photos from Openverse and add them to your media.",
  routes: freePhotosRoutes,
});
