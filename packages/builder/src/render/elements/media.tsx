import {
  audioComponent,
  beforeAfterComponent,
  carouselComponent,
  consentServiceForEmbed,
  consentServiceForVideo,
  type ConsentService,
  embedComponent,
  galleryComponent,
  iconComponent,
  logoStripComponent,
  mapComponent,
  openStreetMapService,
  slideComponent,
  testimonialSliderComponent,
  videoComponent,
} from "@lintel/builder-model";
import {
  Children,
  createContext,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { drawsProps, type RenderMode } from "../component-registry.js";
import { cx } from "./behaviour-types.js";
import { findSiteIcon } from "./icon-set.js";
import { inSentence, openStreetMapAddresses, videoEmbed } from "./media-addresses.js";

/**
 * Media elements. Nothing from another site loads until a visitor asks for it: videos,
 * maps and embeds start as a placeholder with a button (and a plain link that works without
 * script), and the elements script swaps in the real frame, by itself once the visitor has
 * accepted that service in the site's cookie notice.
 */

/** An icon of the site's set as inline SVG, decorative: the words beside it say what it is. */
export function SiteIcon({ name, className }: { name: string; className?: string }) {
  const icon = findSiteIcon(name);
  return icon ? createElement(icon, { "aria-hidden": true, focusable: "false", className }) : null;
}

/**
 * A placeholder that becomes an iframe when the visitor presses its button, or as soon as
 * they have accepted its service (`data-consent-service`) in the cookie notice.
 */
function ConsentFrame({
  frameUrl,
  frameTitle,
  provider,
  service,
  linkUrl,
  linkLabel,
  verb = "Load",
  mode,
  children,
}: {
  frameUrl: string;
  frameTitle: string;
  provider: string;
  service: ConsentService | null;
  linkUrl: string;
  linkLabel: string;
  /** "Play" for videos; "Load" for maps and other embeds. */
  verb?: "Play" | "Load";
  mode: RenderMode;
  children?: ReactNode;
}) {
  return (
    <div
      className="lintel-consent"
      data-behaviour="consent-frame"
      data-frame-src={mode === "site" ? frameUrl : undefined}
      data-frame-title={frameTitle}
      data-consent-service={service?.id}
    >
      {children}
      <div className="lintel-consent__notice">
        <button type="button" className="lintel-consent__load lintel-button">
          <SiteIcon name="play" className="lintel-consent__icon" />
          <span>
            {verb} {inSentence(frameTitle)}
          </span>
        </button>
        <p className="lintel-consent__text">
          This comes from {provider}, which may set cookies.{" "}
          <a href={mode === "site" ? linkUrl : undefined} rel="noopener noreferrer" target="_blank">
            {linkLabel}
          </a>
        </p>
      </div>
    </div>
  );
}

const Video = drawsProps(videoComponent, ({ props, attributes, mode }) => {
  const shape = `lintel-video--${props.shape.replace(":", "-")}`;
  const className = cx(attributes.className, "lintel-video", shape);
  if (props.source === "file") {
    if (!props.url)
      return mode === "canvas" ? (
        <div {...attributes} className={className} data-lintel-placeholder="video" />
      ) : null;
    return (
      <figure {...attributes} className={className}>
        <video
          className="lintel-video__player"
          src={props.url}
          poster={props.poster || undefined}
          controls
          preload="metadata"
          playsInline
          muted={props.autoplayMuted || undefined}
          autoPlay={(props.autoplayMuted && mode === "site") || undefined}
          loop={props.loop || undefined}
          aria-label={props.title}
          data-behaviour={props.autoplayMuted ? "video" : undefined}
        >
          {props.captionsUrl && <track kind="captions" src={props.captionsUrl} default />}
        </video>
      </figure>
    );
  }
  const embed = videoEmbed(props.source, props.url, props.autoplayMuted, props.loop);
  if (!embed)
    return mode === "canvas" ? (
      <div {...attributes} className={className} data-lintel-placeholder="video" />
    ) : null;
  return (
    <figure {...attributes} className={className}>
      <ConsentFrame
        frameUrl={embed.embedUrl}
        frameTitle={props.title}
        verb="Play"
        provider={embed.provider === "youtube" ? "YouTube" : "Vimeo"}
        service={consentServiceForVideo(embed.provider)}
        linkUrl={embed.watchUrl}
        linkLabel={`Watch on ${embed.provider === "youtube" ? "YouTube" : "Vimeo"}`}
        mode={mode}
      >
        {props.poster && (
          <img className="lintel-consent__poster" src={props.poster} alt="" loading="lazy" />
        )}
      </ConsentFrame>
    </figure>
  );
});

const Audio = drawsProps(audioComponent, ({ props, attributes, mode }) => {
  if (!props.url && mode === "site") return null;
  return (
    <figure {...attributes} className={cx(attributes.className, "lintel-audio")}>
      <figcaption className="lintel-audio__title">{props.title}</figcaption>
      <audio
        className="lintel-audio__player"
        controls
        preload="none"
        src={props.url || undefined}
      />
      {props.transcript && (
        <details className="lintel-audio__transcript">
          <summary>Transcript</summary>
          <p>{props.transcript}</p>
        </details>
      )}
    </figure>
  );
});

const Gallery = drawsProps(galleryComponent, ({ props, attributes, mode }) => {
  const pictures = props.pictures.filter((picture) => picture.image.src);
  const className = cx(
    attributes.className,
    "lintel-gallery",
    `lintel-gallery--${props.arrangement}`,
    `lintel-gallery--columns-${props.columns}`,
  );
  if (pictures.length === 0) {
    return mode === "canvas" ? (
      <div {...attributes} className={className} data-lintel-placeholder="gallery" />
    ) : null;
  }
  return (
    <ul
      {...attributes}
      className={className}
      data-behaviour={props.opensBigger ? "gallery" : undefined}
    >
      {pictures.map((picture, index) => {
        const image = (
          <img src={picture.image.src} alt={picture.image.alt} loading="lazy" decoding="async" />
        );
        return (
          <li key={index} className="lintel-gallery__item">
            <figure>
              {props.opensBigger ? (
                <a
                  className="lintel-gallery__open"
                  href={mode === "site" ? picture.image.src : undefined}
                  data-caption={picture.caption || undefined}
                >
                  {image}
                </a>
              ) : (
                image
              )}
              {picture.caption && <figcaption>{picture.caption}</figcaption>}
            </figure>
          </li>
        );
      })}
    </ul>
  );
});

const SlideCountContext = createContext<{ ids: readonly string[] }>({ ids: [] });

function slideIds(children: ReactNode): string[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const node = (child as ReactElement<{ node?: { id: string; hidden: boolean } }>).props.node;
    return node && !node.hidden ? [node.id] : [];
  });
}

interface SliderProps {
  label: string;
  perView: number;
  autoplay: boolean;
  autoplaySeconds: number;
  loop: boolean;
  showDots: boolean;
  /** Dragged freely with momentum, without snapping to each slide (the Slider only). */
  freeDrag?: boolean;
  /** On phones, the next slide peeks in at the edge, when there is more than one (the Slider only). */
  phonePeek?: boolean;
}

/**
 * A slider: a row of slides that scrolls sideways with snap points, so touch swiping and
 * trackpads work natively. Buttons, dots and arrow keys come from the elements script,
 * which also plays it by itself only when asked to, stops on hover and focus, and never
 * moves by itself for people who prefer reduced motion. Autoplay always has a pause button.
 */
function Slider({
  props,
  attributes,
  children,
  extraClass,
}: {
  props: SliderProps;
  attributes: { className: string };
  children: ReactNode;
  extraClass?: string;
}) {
  const ids = slideIds(children);
  return (
    <section
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-carousel",
        `lintel-carousel--per-view-${props.perView}`,
        props.freeDrag && "lintel-carousel--free",
        props.phonePeek && ids.length > 1 && "lintel-carousel--peek",
        extraClass,
      )}
      aria-roledescription="carousel"
      aria-label={props.label || undefined}
      data-behaviour="carousel"
      data-autoplay={props.autoplay ? String(props.autoplaySeconds) : undefined}
      data-loop={props.loop && !props.freeDrag ? "" : undefined}
      data-free-drag={props.freeDrag ? "" : undefined}
    >
      <div className="lintel-carousel__controls">
        {props.autoplay && (
          <button
            type="button"
            className="lintel-carousel__pause"
            data-carousel="pause"
            aria-pressed="false"
          >
            Pause
          </button>
        )}
        <button
          type="button"
          className="lintel-carousel__button"
          data-carousel="previous"
          aria-label="Previous slide"
        >
          <SiteIcon name="chevron-left" />
        </button>
        <button
          type="button"
          className="lintel-carousel__button"
          data-carousel="next"
          aria-label="Next slide"
        >
          <SiteIcon name="chevron-right" />
        </button>
      </div>
      <SlideCountContext.Provider value={{ ids }}>
        <div
          className="lintel-carousel__track"
          tabIndex={0}
          aria-live={props.autoplay ? "off" : "polite"}
        >
          {children}
        </div>
      </SlideCountContext.Provider>
      {props.showDots && ids.length > 1 && (
        <div className="lintel-carousel__dots">
          {ids.map((id, index) => (
            <button
              key={id}
              type="button"
              className="lintel-carousel__dot"
              data-carousel="dot"
              aria-label={`Slide ${index + 1} of ${ids.length}`}
              aria-current={index === 0 ? "true" : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}

const Carousel = drawsProps(carouselComponent, ({ props, attributes, children }) => (
  <Slider props={props} attributes={attributes}>
    {children}
  </Slider>
));

const TestimonialSlider = drawsProps(
  testimonialSliderComponent,
  ({ props, attributes, children }) => (
    <Slider props={props} attributes={attributes} extraClass="lintel-carousel--testimonials">
      {children}
    </Slider>
  ),
);

const Slide = drawsProps(slideComponent, ({ props, attributes, children, node }) => {
  const { ids } = useContext(SlideCountContext);
  const position = ids.indexOf(node.id) + 1;
  return (
    <div
      {...attributes}
      className={cx(attributes.className, "lintel-carousel__slide")}
      role="group"
      aria-roledescription="slide"
      aria-label={props.label || (position > 0 ? `${position} of ${ids.length}` : undefined)}
    >
      {children}
    </div>
  );
});

const BeforeAfter = drawsProps(beforeAfterComponent, ({ props, attributes, mode }) => {
  const className = cx(attributes.className, "lintel-before-after");
  if (!props.before.src || !props.after.src) {
    return mode === "canvas" ? (
      <div {...attributes} className={className} data-lintel-placeholder="image" />
    ) : null;
  }
  return (
    <figure
      {...attributes}
      className={className}
      data-behaviour="before-after"
      data-start={props.start}
    >
      <div className="lintel-before-after__frame">
        <img className="lintel-before-after__after" src={props.after.src} alt={props.after.alt} />
        <div className="lintel-before-after__before">
          <img src={props.before.src} alt={props.before.alt} />
        </div>
        <span
          className="lintel-before-after__label lintel-before-after__label--before"
          aria-hidden="true"
        >
          {props.beforeLabel}
        </span>
        <span
          className="lintel-before-after__label lintel-before-after__label--after"
          aria-hidden="true"
        >
          {props.afterLabel}
        </span>
        <span className="lintel-before-after__handle" aria-hidden="true" />
        <input
          className="lintel-before-after__range"
          type="range"
          min={0}
          max={100}
          defaultValue={props.start}
          aria-label={`Compare ${props.beforeLabel.toLowerCase()} and ${props.afterLabel.toLowerCase()}`}
          aria-valuetext={`${props.start}% ${props.beforeLabel.toLowerCase()}`}
        />
      </div>
    </figure>
  );
});

const Icon = drawsProps(iconComponent, ({ props, attributes }) => (
  <span
    {...attributes}
    className={cx(
      attributes.className,
      "lintel-icon",
      `lintel-icon--${props.size}`,
      props.motion !== "none" && `lintel-icon--${props.motion}`,
    )}
    role={props.label ? "img" : undefined}
    aria-label={props.label || undefined}
    aria-hidden={props.label ? undefined : "true"}
  >
    <SiteIcon name={props.name} />
  </span>
));

const LogoStrip = drawsProps(logoStripComponent, ({ props, attributes, mode }) => {
  const logos = props.logos.filter((logo) => logo.image.src);
  const list = (hidden: boolean) => (
    <ul className="lintel-logos__list" aria-hidden={hidden || undefined}>
      {logos.map((logo, index) => {
        const image = (
          <img src={logo.image.src} alt={hidden ? "" : logo.image.alt} loading="lazy" />
        );
        return (
          <li key={index} className="lintel-logos__logo">
            {logo.href ? (
              <a href={mode === "site" ? logo.href : undefined} tabIndex={hidden ? -1 : undefined}>
                {image}
              </a>
            ) : (
              image
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <section
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-logos",
        props.scrolls && "lintel-logos--scrolls",
        props.greyscale && "lintel-logos--grey",
      )}
      aria-label={props.title || "Logos"}
    >
      {props.title && <p className="lintel-logos__title">{props.title}</p>}
      {logos.length === 0 && mode === "canvas" ? (
        <div data-lintel-placeholder="gallery" />
      ) : (
        <div className="lintel-logos__track">
          {list(false)}
          {props.scrolls && list(true)}
        </div>
      )}
    </section>
  );
});

const MapElement = drawsProps(mapComponent, ({ props, attributes, mode }) => {
  const { embedUrl, linkUrl } = openStreetMapAddresses(props.latitude, props.longitude, props.zoom);
  return (
    <figure {...attributes} className={cx(attributes.className, "lintel-map")}>
      <ConsentFrame
        frameUrl={embedUrl}
        frameTitle={`a map of ${props.placeName}`}
        provider="OpenStreetMap"
        service={openStreetMapService}
        linkUrl={linkUrl}
        linkLabel="Open the map on OpenStreetMap"
        mode={mode}
      >
        <SiteIcon name="map-pin" className="lintel-map__pin" />
      </ConsentFrame>
      <figcaption className="lintel-map__caption">
        <strong>{props.placeName}</strong>
        {props.address && <address>{props.address}</address>}
      </figcaption>
    </figure>
  );
});

const Embed = drawsProps(embedComponent, ({ props, attributes, mode }) => {
  const className = cx(attributes.className, "lintel-embed");
  if (!props.url)
    return mode === "canvas" ? (
      <div {...attributes} className={className} data-lintel-placeholder="embed" />
    ) : null;
  const host = /^https:\/\/([^/?#:]+)/i.exec(props.url)?.[1] ?? "another website";
  return (
    <div {...attributes} className={className} data-height={props.height}>
      {props.loadsStraightAway && mode === "site" ? (
        <iframe
          src={props.url}
          title={props.title}
          height={props.height}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
        />
      ) : (
        <ConsentFrame
          frameUrl={props.url}
          frameTitle={props.title}
          provider={host}
          service={consentServiceForEmbed(props.url)}
          linkUrl={props.url}
          linkLabel={`Open it on ${host}`}
          mode={mode}
        />
      )}
    </div>
  );
});

export const mediaRenders = {
  video: Video,
  audio: Audio,
  gallery: Gallery,
  carousel: Carousel,
  testimonialSlider: TestimonialSlider,
  slide: Slide,
  beforeAfter: BeforeAfter,
  icon: Icon,
  logoStrip: LogoStrip,
  map: MapElement,
  embed: Embed,
};
