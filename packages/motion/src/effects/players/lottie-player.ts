import type { LottiePlayer } from "lottie-web";
import player from "lottie-web/build/player/lottie_light.js";

/**
 * lottie-web's light build (MIT): draws SVG and never runs code from a file. Bundled on its
 * own and fetched by the Lottie module only when a page has a Lottie near the screen. The
 * build is a UMD file whose whole export is the player, which its types describe as a module.
 */
export default player as unknown as LottiePlayer;
