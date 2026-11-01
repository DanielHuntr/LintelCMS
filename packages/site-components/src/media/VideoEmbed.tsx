import { classNames } from "../class-names.js";

/** A video field's value as Lintel's delivery API sends it. */
export interface SiteVideo {
  url: string;
  provider: "youtube" | "vimeo" | "file";
  /** Where to point the player: the provider's embed address, or the file itself. */
  embedUrl: string;
}

export interface VideoEmbedProps {
  video: SiteVideo | null;
  /** Names the player for screen readers, such as the video's subject. */
  title: string;
  field?: string;
  className?: string;
}

/**
 * A video at 16:9. YouTube and Vimeo play in their own player (YouTube's privacy-enhanced
 * one); a file plays in the browser's. Output: `<div class="lintel-video">` around an
 * `<iframe>` or a `<video controls>`. Nothing is drawn without a video.
 */
export function VideoEmbed({ video, title, field, className }: VideoEmbedProps) {
  if (!video) {
    return null;
  }
  return (
    <div className={classNames("lintel-video", className)} data-lintel-field={field}>
      {video.provider === "file" ? (
        <video src={video.embedUrl} controls preload="metadata" title={title} />
      ) : (
        <iframe
          src={video.embedUrl}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      )}
    </div>
  );
}
