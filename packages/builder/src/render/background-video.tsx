import type { BackgroundVideo as VideoSetting, PageNode } from "@lintel/builder-model";
import type { RenderMode } from "./component-registry.js";

/**
 * A section's background video: muted, looping, decorative (hidden from screen readers),
 * covering the section behind its content. It isn't set to autoplay in the HTML; the script
 * below starts it only for visitors who haven't asked for less motion, and shows a button
 * to pause or play it, so without scripts (or with reduced motion) the poster is all that
 * shows. The base stylesheet (`designBaseStylesheet`) places it.
 */
export function BackgroundVideo({ video, mode }: { video: VideoSetting; mode: RenderMode }) {
  return (
    <div className="lintel-video-background">
      <video
        src={video.src}
        poster={video.poster || undefined}
        muted
        loop
        playsInline
        preload={mode === "canvas" ? "metadata" : "auto"}
        aria-hidden="true"
        tabIndex={-1}
        data-lintel-video=""
      />
      {mode === "site" && (
        <button type="button" className="lintel-video-toggle" hidden>
          Pause background video
        </button>
      )}
    </div>
  );
}

export function hasBackgroundVideo(node: PageNode): boolean {
  return (
    (!node.hidden && node.backgroundVideo !== undefined) || node.children.some(hasBackgroundVideo)
  );
}

/** Starts background videos for visitors who don't prefer reduced motion; the buttons pause them. */
export const backgroundVideoScript = `document.addEventListener("DOMContentLoaded", function () {
  var lessMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  document.querySelectorAll("video[data-lintel-video]").forEach(function (video) {
    var button = video.nextElementSibling;
    function show() {
      if (button) button.textContent = video.paused ? "Play background video" : "Pause background video";
    }
    video.muted = true;
    video.addEventListener("play", show);
    video.addEventListener("pause", show);
    if (button) {
      button.hidden = false;
      button.addEventListener("click", function () {
        if (video.paused) video.play(); else video.pause();
      });
    }
    if (!lessMotion.matches) video.play().catch(show);
    show();
  });
});`;
