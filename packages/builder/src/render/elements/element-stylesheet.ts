import { effectElementsStylesheet } from "./effects.js";

/**
 * The element library's own look, in one stylesheet the website and the canvas both load
 * (after the design base rules). Every rule is wrapped in `:where()`, so it has no weight
 * and anything set in the Style panel wins. Colours, spacing and corners are the theme's
 * tokens, so elements follow the site's theme in light and dark. Motion stops for people
 * who ask for less of it.
 */

const tablet = "@media (max-width: 991px)";
const phone = "@media (max-width: 767px)";

function columns(prefix: string, media?: string): string {
  const rules = [1, 2, 3, 4, 5, 6]
    .map(
      (count) =>
        `:where(.lintel-grid--${prefix}-${count}) { grid-template-columns: repeat(${count}, minmax(0, 1fr)); }`,
    )
    .join("\n");
  return media ? `${media} {\n${rules}\n}` : rules;
}

const layout = `
:where(.lintel-visually-hidden) {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
}
:where(.lintel-button) {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--lintel-space-2);
  min-height: 2.75rem; padding: var(--lintel-space-2) var(--lintel-space-5);
  border: 1px solid transparent; border-radius: var(--lintel-radius-button);
  background: var(--lintel-color-brand); color: var(--lintel-color-on-brand);
  font: inherit; font-weight: 600; text-decoration: none; cursor: pointer;
}
:where(.lintel-button:hover) { opacity: 0.88; }
:where(.lintel-button:disabled) { opacity: 0.5; cursor: not-allowed; }
:where(.lintel-button--secondary) {
  background: transparent; color: var(--lintel-color-text); border-color: var(--lintel-color-border);
}
/* A link styled as a button keeps the button's text colour. As specific as the site's own
   "a" rule and after it, so it wins over link colours but never over a class the style panel sets. */
a:where(.lintel-button) { color: var(--lintel-color-on-brand); }
a:where(.lintel-button--secondary) { color: var(--lintel-color-text); }
:where(.lintel-design) :where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--lintel-color-brand); outline-offset: 2px;
}
:where(.lintel-grid) { display: grid; gap: var(--lintel-space-6); }
:where(.lintel-grid--gap-small) { gap: var(--lintel-space-3); }
:where(.lintel-grid--gap-large) { gap: var(--lintel-space-8); }
${columns("columns")}
${columns("tablet", tablet)}
${columns("phone", phone)}
:where(.lintel-spacer) { block-size: var(--lintel-space-7); }
:where(.lintel-spacer--small) { block-size: var(--lintel-space-4); }
:where(.lintel-spacer--large) { block-size: var(--lintel-space-9, 6rem); }
:where(.lintel-spacer--extraLarge) { block-size: calc(var(--lintel-space-9, 6rem) * 1.5); }
${phone} { :where(.lintel-spacer) { block-size: var(--lintel-space-5); } :where(.lintel-spacer--large, .lintel-spacer--extraLarge) { block-size: var(--lintel-space-7); } }
:where(.lintel-card) {
  display: flex; flex-direction: column; gap: var(--lintel-space-3); padding: var(--lintel-space-5);
  border-radius: var(--lintel-radius-large, var(--lintel-radius-medium)); color: inherit; text-decoration: none;
  background: var(--lintel-color-background);
}
:where(.lintel-card) :where(img) { border-radius: var(--lintel-radius-medium); aspect-ratio: 3 / 2; object-fit: cover; width: 100%; }
:where(.lintel-card--outlined) { border: 1px solid var(--lintel-color-border); }
:where(.lintel-card--raised) { box-shadow: 0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px rgb(0 0 0 / 0.08); }
:where(.lintel-card--filled) { background: var(--lintel-color-surface); }
:where(.lintel-card--plain) { padding: 0; background: transparent; }
/* A linked card is a link: as weak as a class, so it beats the site's link colour while the
   Style panel's own class (later in the page) still wins. */
.lintel-card--linked { color: inherit; text-decoration: none; }
:where(.lintel-card--linked) { transition: transform 0.15s ease, box-shadow 0.15s ease; }
:where(.lintel-card--linked:hover) { transform: translateY(-2px); }
:where(.lintel-tabs__list) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-1); border-bottom: 1px solid var(--lintel-color-border); }
:where(.lintel-tabs__tab) {
  padding: var(--lintel-space-3) var(--lintel-space-4); border: 0; border-bottom: 2px solid transparent;
  background: none; color: var(--lintel-color-text-secondary); font: inherit; font-weight: 600; cursor: pointer;
}
:where(.lintel-tabs__tab[aria-selected="true"]) { color: var(--lintel-color-text); border-bottom-color: var(--lintel-color-brand); }
:where(.lintel-tabs__panel) { padding-top: var(--lintel-space-5); }
:where(.lintel-tabs__panel[hidden]) { display: none; }
:where(.lintel-accordion) { display: flex; flex-direction: column; border-top: 1px solid var(--lintel-color-border); }
:where(.lintel-accordion__item) { border-bottom: 1px solid var(--lintel-color-border); }
:where(.lintel-accordion__title) {
  display: flex; justify-content: space-between; gap: var(--lintel-space-4); padding: var(--lintel-space-4) 0;
  font-weight: 600; cursor: pointer; list-style: none;
}
:where(.lintel-accordion__title)::-webkit-details-marker { display: none; }
:where(.lintel-accordion__title)::after { content: "+"; font-size: 1.25em; line-height: 1; }
:where(.lintel-accordion__item[open] > .lintel-accordion__title)::after { content: "−"; }
:where(.lintel-accordion__body) { padding-bottom: var(--lintel-space-4); display: flex; flex-direction: column; gap: var(--lintel-space-3); }
:where(.lintel-modal__dialog) {
  width: min(40rem, calc(100vw - 2rem)); max-height: calc(100dvh - 2rem); padding: 0; border: 0;
  border-radius: var(--lintel-radius-large, var(--lintel-radius-medium));
  background: var(--lintel-color-background); color: var(--lintel-color-text);
  box-shadow: 0 24px 64px rgb(0 0 0 / 0.3);
}
:where(.lintel-modal__dialog)::backdrop { background: rgb(0 0 0 / 0.55); }
:where(.lintel-modal__dialog--small) { width: min(26rem, calc(100vw - 2rem)); }
:where(.lintel-modal__dialog--large) { width: min(64rem, calc(100vw - 2rem)); }
:where(.lintel-modal__dialog--full) { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; border-radius: 0; }
:where(.lintel-modal__header) { display: flex; align-items: center; justify-content: space-between; gap: var(--lintel-space-4); padding: var(--lintel-space-4) var(--lintel-space-5); border-bottom: 1px solid var(--lintel-color-border); }
:where(.lintel-modal__title) { font-size: 1.25rem; }
:where(.lintel-modal__close, .lintel-drawer__close) {
  display: inline-flex; align-items: center; justify-content: center; inline-size: 2.75rem; block-size: 2.75rem;
  border: 0; border-radius: 999px; background: var(--lintel-color-surface); color: inherit; font-size: 1.5rem; cursor: pointer;
}
:where(.lintel-modal__body) { padding: var(--lintel-space-5); display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-modal__preview) { margin-top: var(--lintel-space-3); padding: var(--lintel-space-4); border: 1px dashed var(--lintel-color-border); border-radius: var(--lintel-radius-medium); }
:where(.lintel-sticky) { position: sticky; z-index: 5; }
:where(.lintel-sticky--top) { top: 0; }
:where(.lintel-sticky--bottom) { bottom: 0; }
:where(.lintel-sticky--top.lintel-sticky--offset-small) { top: var(--lintel-space-3); }
:where(.lintel-sticky--top.lintel-sticky--offset-medium) { top: var(--lintel-space-5); }
:where(.lintel-sticky--top.lintel-sticky--offset-large) { top: var(--lintel-space-7); }
:where(.lintel-sticky--bottom.lintel-sticky--offset-small) { bottom: var(--lintel-space-3); }
:where(.lintel-sticky--bottom.lintel-sticky--offset-medium) { bottom: var(--lintel-space-5); }
:where(.lintel-sticky--bottom.lintel-sticky--offset-large) { bottom: var(--lintel-space-7); }
`;

const media = `
:where(.lintel-video) { position: relative; inline-size: 100%; aspect-ratio: 16 / 9; overflow: hidden; border-radius: var(--lintel-radius-medium); background: #111; }
:where(.lintel-video--4-3) { aspect-ratio: 4 / 3; }
:where(.lintel-video--1-1) { aspect-ratio: 1; }
:where(.lintel-video--9-16) { aspect-ratio: 9 / 16; max-inline-size: 24rem; }
:where(.lintel-video__player, .lintel-video iframe) { display: block; inline-size: 100%; block-size: 100%; border: 0; object-fit: cover; }
:where(.lintel-consent) {
  position: relative; display: grid; place-items: center; inline-size: 100%; block-size: 100%; min-block-size: 14rem;
  background: var(--lintel-color-surface); color: var(--lintel-color-text);
}
:where(.lintel-video .lintel-consent) { background: #111; color: #fff; }
:where(.lintel-consent__poster) { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; object-fit: cover; opacity: 0.6; }
:where(.lintel-consent__notice) { position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--lintel-space-2); padding: var(--lintel-space-4); text-align: center; }
:where(.lintel-consent__text) { font-size: 0.875rem; max-inline-size: 28rem; }
:where(.lintel-consent__text a) { color: inherit; }
:where(.lintel-consent__icon) { inline-size: 1.25rem; block-size: 1.25rem; }
:where(.lintel-consent iframe, .lintel-embed iframe) { inline-size: 100%; block-size: 100%; min-block-size: inherit; border: 0; }
:where(.lintel-embed) { inline-size: 100%; min-block-size: 16rem; border-radius: var(--lintel-radius-medium); overflow: hidden; }
:where(.lintel-map) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-map .lintel-consent) { aspect-ratio: 16 / 9; min-block-size: 16rem; border-radius: var(--lintel-radius-medium); overflow: hidden; }
:where(.lintel-map__pin) { position: absolute; inset-block-start: 22%; inline-size: 2rem; block-size: 2rem; color: var(--lintel-color-brand); }
:where(.lintel-map__caption address) { font-style: normal; white-space: pre-line; color: var(--lintel-color-text-secondary); }
:where(.lintel-audio) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-audio__title) { margin: 0; font-weight: 600; color: inherit; font-size: 1rem; }
:where(.lintel-audio__player) { inline-size: 100%; }
:where(.lintel-gallery) { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--lintel-space-3); grid-template-columns: repeat(var(--lintel-gallery-columns, 3), minmax(0, 1fr)); }
${[2, 3, 4, 5, 6].map((count) => `:where(.lintel-gallery--columns-${count}) { --lintel-gallery-columns: ${count}; }`).join("\n")}
${tablet} { :where(.lintel-gallery) { --lintel-gallery-columns: 2; } }
:where(.lintel-gallery__item img) { inline-size: 100%; block-size: 100%; object-fit: cover; border-radius: var(--lintel-radius-small, 0.25rem); }
:where(.lintel-gallery--grid .lintel-gallery__item img) { aspect-ratio: 1; }
:where(.lintel-gallery--masonry) { display: block; columns: var(--lintel-gallery-columns, 3); column-gap: var(--lintel-space-3); }
:where(.lintel-gallery--masonry .lintel-gallery__item) { break-inside: avoid; margin-bottom: var(--lintel-space-3); }
:where(.lintel-gallery--justified) { display: flex; flex-wrap: wrap; }
:where(.lintel-gallery--justified .lintel-gallery__item) { flex: 1 1 14rem; block-size: 14rem; }
${phone} { :where(.lintel-gallery--justified .lintel-gallery__item) { flex-basis: 40%; block-size: 9rem; } }
:where(.lintel-gallery__open) { display: block; block-size: 100%; cursor: zoom-in; }
:where(.lintel-lightbox) { inline-size: 100vw; max-inline-size: 100vw; block-size: 100dvh; max-block-size: 100dvh; margin: 0; padding: var(--lintel-space-5); border: 0; background: rgb(0 0 0 / 0.92); color: #fff; }
:where(.lintel-lightbox[open]) { display: grid; grid-template: "close" auto "picture" 1fr "controls" auto / 1fr; gap: var(--lintel-space-3); }
:where(.lintel-lightbox img) { grid-area: picture; place-self: center; max-inline-size: 100%; max-block-size: 100%; object-fit: contain; }
:where(.lintel-lightbox__close) { grid-area: close; justify-self: end; }
:where(.lintel-lightbox__controls) { grid-area: controls; display: flex; justify-content: center; align-items: center; gap: var(--lintel-space-4); }
:where(.lintel-lightbox button) { min-inline-size: 2.75rem; min-block-size: 2.75rem; border: 1px solid rgb(255 255 255 / 0.4); border-radius: 999px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
:where(.lintel-carousel) { position: relative; display: flex; flex-direction: column; gap: var(--lintel-space-3); --lintel-per-view: 1; }
${[2, 3, 4].map((count) => `:where(.lintel-carousel--per-view-${count}) { --lintel-per-view: ${count}; }`).join("\n")}
${tablet} { :where(.lintel-carousel--per-view-3, .lintel-carousel--per-view-4) { --lintel-per-view: 2; } }
${phone} { :where(.lintel-carousel) { --lintel-per-view: 1; } }
:where(.lintel-carousel__track) {
  display: grid; grid-auto-flow: column; grid-auto-columns: calc((100% - (var(--lintel-per-view) - 1) * var(--lintel-space-4)) / var(--lintel-per-view));
  gap: var(--lintel-space-4); overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; overscroll-behavior-x: contain; scrollbar-width: none;
}
:where(.lintel-carousel__track)::-webkit-scrollbar { display: none; }
:where(.lintel-carousel__slide) { scroll-snap-align: start; display: flex; flex-direction: column; gap: var(--lintel-space-3); min-inline-size: 0; }
:where(.lintel-carousel__controls) { display: flex; justify-content: flex-end; gap: var(--lintel-space-2); order: 2; }
:where(.lintel-carousel__button, .lintel-carousel__pause) {
  display: inline-flex; align-items: center; justify-content: center; min-inline-size: 2.75rem; block-size: 2.75rem; padding: 0 var(--lintel-space-3);
  border: 1px solid var(--lintel-color-border); border-radius: 999px; background: var(--lintel-color-background); color: var(--lintel-color-text); font: inherit; cursor: pointer;
}
:where(.lintel-carousel__button:disabled) { opacity: 0.4; cursor: default; }
:where(.lintel-carousel__dots) { display: flex; justify-content: center; gap: var(--lintel-space-1); order: 3; }
:where(.lintel-carousel__dot) { inline-size: 1.5rem; block-size: 1.5rem; padding: 0; border: 0; background: none; cursor: pointer; }
:where(.lintel-carousel__dot)::before { content: ""; display: block; margin: auto; inline-size: 0.5rem; block-size: 0.5rem; border-radius: 999px; background: var(--lintel-color-border); }
:where(.lintel-carousel__dot[aria-current="true"])::before { background: var(--lintel-color-brand); inline-size: 1.25rem; }
:where(.lintel-before-after__frame) { position: relative; overflow: hidden; border-radius: var(--lintel-radius-medium); --lintel-position: 50%; }
:where(.lintel-before-after__frame img) { display: block; inline-size: 100%; block-size: auto; }
:where(.lintel-before-after__before) { position: absolute; inset: 0; clip-path: inset(0 calc(100% - var(--lintel-position)) 0 0); }
:where(.lintel-before-after__before img) { block-size: 100%; object-fit: cover; }
:where(.lintel-before-after__handle) { position: absolute; inset-block: 0; inset-inline-start: var(--lintel-position); inline-size: 3px; margin-inline-start: -1.5px; background: #fff; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2); pointer-events: none; }
:where(.lintel-before-after__handle)::after { content: "⇆"; position: absolute; inset-block-start: 50%; inset-inline-start: 50%; translate: -50% -50%; display: grid; place-items: center; inline-size: 2.5rem; block-size: 2.5rem; border-radius: 999px; background: #fff; color: #111; }
:where(.lintel-before-after__range) { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; margin: 0; opacity: 0; cursor: ew-resize; }
:where(.lintel-before-after__range:focus-visible ~ .lintel-before-after__handle, .lintel-before-after__frame:has(.lintel-before-after__range:focus-visible) .lintel-before-after__handle) { outline: 3px solid var(--lintel-color-brand); }
:where(.lintel-before-after__label) { position: absolute; inset-block-start: var(--lintel-space-3); padding: var(--lintel-space-1) var(--lintel-space-2); border-radius: var(--lintel-radius-small, 0.25rem); background: rgb(0 0 0 / 0.6); color: #fff; font-size: 0.875rem; }
:where(.lintel-before-after__label--before) { inset-inline-start: var(--lintel-space-3); }
:where(.lintel-before-after__label--after) { inset-inline-end: var(--lintel-space-3); }
:where(.lintel-icon) { display: inline-flex; color: var(--lintel-color-brand); }
:where(.lintel-icon svg) { inline-size: 1.5rem; block-size: 1.5rem; }
:where(.lintel-icon--small svg) { inline-size: 1rem; block-size: 1rem; }
:where(.lintel-icon--large svg) { inline-size: 2.5rem; block-size: 2.5rem; }
:where(.lintel-icon--extraLarge svg) { inline-size: 4rem; block-size: 4rem; }
:where(.lintel-icon--spin svg) { animation: lintel-spin 2.4s linear infinite; }
:where(.lintel-icon--pulse svg) { animation: lintel-pulse 1.8s ease-in-out infinite; }
:where(.lintel-icon--bounce svg) { animation: lintel-bounce 1.6s ease-in-out infinite; }
@keyframes lintel-spin { to { rotate: 360deg; } }
@keyframes lintel-pulse { 50% { scale: 0.85; opacity: 0.7; } }
@keyframes lintel-bounce { 50% { translate: 0 -20%; } }
:where(.lintel-logos) { display: flex; flex-direction: column; gap: var(--lintel-space-4); overflow: hidden; }
:where(.lintel-logos__title) { text-align: center; color: var(--lintel-color-text-secondary); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.08em; }
:where(.lintel-logos__track) { display: flex; gap: var(--lintel-space-7); }
:where(.lintel-logos__list) { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: var(--lintel-space-7); margin: 0; padding: 0; list-style: none; flex: 1 0 auto; }
:where(.lintel-logos__logo img) { block-size: 2.5rem; inline-size: auto; max-inline-size: 9rem; object-fit: contain; }
:where(.lintel-logos--grey .lintel-logos__logo img) { filter: grayscale(1); opacity: 0.75; }
:where(.lintel-logos--scrolls .lintel-logos__list) { flex-wrap: nowrap; animation: lintel-scroll 40s linear infinite; }
:where(.lintel-logos--scrolls:hover .lintel-logos__list, .lintel-logos--scrolls:focus-within .lintel-logos__list) { animation-play-state: paused; }
`;

const text = `
:where(.lintel-marquee) { overflow: hidden; padding-block: var(--lintel-space-3); }
:where(.lintel-marquee__track) { display: flex; inline-size: max-content; }
:where(.lintel-marquee__list) { display: flex; gap: var(--lintel-space-7); margin: 0; padding: 0 var(--lintel-space-7) 0 0; list-style: none; font-size: 1.25rem; font-weight: 600; white-space: nowrap; animation: lintel-scroll var(--lintel-marquee-speed, 30s) linear infinite; }
:where(.lintel-marquee--slow) { --lintel-marquee-speed: 50s; }
:where(.lintel-marquee--fast) { --lintel-marquee-speed: 15s; }
:where(.lintel-marquee--right .lintel-marquee__list) { animation-direction: reverse; }
:where(.lintel-marquee:hover .lintel-marquee__list, .lintel-marquee:focus-within .lintel-marquee__list) { animation-play-state: paused; }
@keyframes lintel-scroll { to { translate: -100% 0; } }
:where(.lintel-counter) { display: flex; flex-direction: column; gap: var(--lintel-space-1); }
:where(.lintel-counter__value) { font-family: var(--lintel-font-heading); font-size: clamp(2.25rem, 5vw, 3.5rem); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--lintel-color-brand); }
:where(.lintel-counter__label) { color: var(--lintel-color-text-secondary); }
:where(.lintel-badge) { display: inline-flex; align-items: center; gap: var(--lintel-space-1); inline-size: fit-content; padding: 0.15em 0.6em; border-radius: 999px; font-size: 0.8125rem; font-weight: 600; line-height: 1.5; background: var(--lintel-color-brand); color: var(--lintel-color-on-brand); }
:where(.lintel-badge__icon) { inline-size: 0.9em; block-size: 0.9em; }
:where(.lintel-badge--neutral) { background: var(--lintel-color-surface); color: var(--lintel-color-text); }
:where(.lintel-badge--success) { background: #1e7a46; color: #fff; }
:where(.lintel-badge--warning) { background: #f2c94c; color: #3d2c00; }
:where(.lintel-badge--danger) { background: #c0392b; color: #fff; }
:where(.lintel-table) { overflow-x: auto; }
:where(.lintel-table__table) { inline-size: 100%; border-collapse: collapse; }
:where(.lintel-table__table caption) { text-align: start; font-weight: 600; padding-bottom: var(--lintel-space-2); }
:where(.lintel-table__table th, .lintel-table__table td) { padding: var(--lintel-space-3); text-align: start; border-bottom: 1px solid var(--lintel-color-border); vertical-align: top; }
:where(.lintel-table__table thead th) { font-size: 0.875rem; color: var(--lintel-color-text-secondary); }
:where(.lintel-table__table--striped tbody tr:nth-child(even)) { background: var(--lintel-color-surface); }
:where(.lintel-timeline) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--lintel-space-6); border-inline-start: 2px solid var(--lintel-color-border); counter-reset: lintel-step; }
:where(.lintel-timeline__item) { position: relative; padding-inline-start: var(--lintel-space-6); display: flex; flex-direction: column; gap: var(--lintel-space-1); counter-increment: lintel-step; }
:where(.lintel-timeline__item)::before { content: ""; position: absolute; inset-inline-start: -0.45rem; inset-block-start: 0.35rem; inline-size: 0.8rem; block-size: 0.8rem; border-radius: 999px; background: var(--lintel-color-brand); }
:where(.lintel-timeline--numbered .lintel-timeline__item)::before { content: counter(lintel-step); inset-inline-start: -0.85rem; inset-block-start: 0; inline-size: 1.6rem; block-size: 1.6rem; display: grid; place-items: center; color: var(--lintel-color-on-brand); font-size: 0.8rem; font-weight: 700; }
:where(.lintel-timeline__when) { font-size: 0.875rem; font-weight: 600; color: var(--lintel-color-brand); }
:where(.lintel-timeline__title) { font-size: 1.125rem; }
:where(.lintel-stars) { display: flex; gap: 2px; color: #e3a008; }
:where(.lintel-stars svg) { inline-size: 1.1rem; block-size: 1.1rem; }
:where(.lintel-stars__on) { fill: currentColor; }
:where(.lintel-stars__off) { opacity: 0.35; }
:where(.lintel-testimonial) { display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-testimonial__quote) { font-size: 1.25rem; line-height: 1.5; }
:where(.lintel-testimonial__person) { display: flex; align-items: center; gap: var(--lintel-space-3); margin: 0; color: inherit; font-size: 1rem; }
:where(.lintel-testimonial__photo) { inline-size: 3rem; block-size: 3rem; border-radius: 999px; object-fit: cover; }
:where(.lintel-testimonial__name) { display: block; font-weight: 600; }
:where(.lintel-testimonial__role) { display: block; font-size: 0.875rem; color: var(--lintel-color-text-secondary); }
:where(.lintel-pricing) { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--lintel-space-5); grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); align-items: stretch; }
:where(.lintel-pricing__plan) { position: relative; display: flex; flex-direction: column; gap: var(--lintel-space-3); padding: var(--lintel-space-6); border: 1px solid var(--lintel-color-border); border-radius: var(--lintel-radius-large, var(--lintel-radius-medium)); }
:where(.lintel-pricing__plan--highlighted) { border: 2px solid var(--lintel-color-brand); box-shadow: 0 12px 32px rgb(0 0 0 / 0.08); }
:where(.lintel-pricing__badge) { position: absolute; inset-block-start: 0; translate: 0 -50%; }
:where(.lintel-pricing__amount) { font-family: var(--lintel-font-heading); font-size: 2.25rem; font-weight: 700; }
:where(.lintel-pricing__period, .lintel-pricing__description) { color: var(--lintel-color-text-secondary); }
:where(.lintel-pricing__features) { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--lintel-space-2); flex: 1; }
:where(.lintel-pricing__features li) { display: flex; gap: var(--lintel-space-2); }
:where(.lintel-pricing__tick) { flex: none; inline-size: 1.2rem; block-size: 1.2rem; color: var(--lintel-color-brand); }
:where(.lintel-social) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-2); margin: 0; padding: 0; list-style: none; }
:where(.lintel-social__link) { display: inline-flex; align-items: center; gap: var(--lintel-space-1); min-block-size: 2.75rem; padding: 0 var(--lintel-space-3); border: 1px solid var(--lintel-color-border); border-radius: 999px; color: inherit; text-decoration: none; font-size: 0.9375rem; }
:where(.lintel-social--small .lintel-social__link) { min-block-size: 2.25rem; font-size: 0.8125rem; }
:where(.lintel-social--large .lintel-social__link) { min-block-size: 3.25rem; font-size: 1.0625rem; }
:where(.lintel-social__icon) { inline-size: 1em; block-size: 1em; }
:where(.lintel-person) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-person__photo) { inline-size: 100%; aspect-ratio: 1; object-fit: cover; border-radius: var(--lintel-radius-medium); margin-bottom: var(--lintel-space-2); }
:where(.lintel-person__role) { color: var(--lintel-color-brand); font-weight: 600; }
:where(.lintel-person__bio) { color: var(--lintel-color-text-secondary); }
:where(.lintel-features) { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--lintel-space-6); grid-template-columns: repeat(var(--lintel-feature-columns, 3), minmax(0, 1fr)); }
${[1, 2, 3, 4].map((count) => `:where(.lintel-features--columns-${count}) { --lintel-feature-columns: ${count}; }`).join("\n")}
:where(.lintel-features--list) { --lintel-feature-columns: 1; gap: var(--lintel-space-4); }
${tablet} { :where(.lintel-features) { --lintel-feature-columns: 2; } }
${phone} { :where(.lintel-features) { --lintel-feature-columns: 1; } }
:where(.lintel-features__item) { display: flex; gap: var(--lintel-space-3); }
:where(.lintel-features--grid .lintel-features__item) { flex-direction: column; }
:where(.lintel-features__icon) { display: grid; place-items: center; flex: none; inline-size: 2.75rem; block-size: 2.75rem; border-radius: var(--lintel-radius-medium); background: var(--lintel-color-surface); color: var(--lintel-color-brand); }
:where(.lintel-features__icon svg) { inline-size: 1.4rem; block-size: 1.4rem; }
:where(.lintel-features__words) { display: flex; flex-direction: column; gap: var(--lintel-space-1); }
:where(.lintel-features__text) { color: var(--lintel-color-text-secondary); }
:where(.lintel-breadcrumbs ol) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-2); margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
:where(.lintel-breadcrumbs li + li)::before { content: "›"; margin-inline-end: var(--lintel-space-2); color: var(--lintel-color-text-secondary); }
:where(.lintel-breadcrumbs [aria-current]) { color: var(--lintel-color-text-secondary); }
:where(.lintel-countdown) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-countdown__units) { display: flex; gap: var(--lintel-space-4); }
:where(.lintel-countdown__unit) { display: flex; flex-direction: column; align-items: center; min-inline-size: 4.5rem; padding: var(--lintel-space-3); border-radius: var(--lintel-radius-medium); background: var(--lintel-color-surface); }
:where(.lintel-countdown__number) { font-family: var(--lintel-font-heading); font-size: 2rem; font-weight: 700; font-variant-numeric: tabular-nums; min-inline-size: 2ch; text-align: center; }
:where(.lintel-countdown__name) { font-size: 0.8125rem; color: var(--lintel-color-text-secondary); }
${phone} { :where(.lintel-countdown__unit) { min-inline-size: 3.5rem; } :where(.lintel-countdown__number) { font-size: 1.5rem; } }
:where(.lintel-rich-text) { display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-rich-text blockquote) { padding-inline-start: var(--lintel-space-4); border-inline-start: 3px solid var(--lintel-color-brand); }
`;

const navigation = `
:where(.lintel-site-header) { display: flex; align-items: center; gap: var(--lintel-space-5); padding: var(--lintel-space-3) var(--lintel-space-5); background: var(--lintel-color-background); position: relative; z-index: 20; }
:where(.lintel-site-header--sticky) { position: sticky; top: 0; box-shadow: 0 1px 0 var(--lintel-color-border); }
:where(.lintel-site-header__brand) { display: inline-flex; align-items: center; gap: var(--lintel-space-2); color: inherit; text-decoration: none; font-family: var(--lintel-font-heading); font-weight: 700; font-size: 1.25rem; }
:where(.lintel-site-header__logo) { block-size: 2.25rem; inline-size: auto; }
:where(.lintel-site-header__nav) { margin-inline-start: auto; }
${tablet} { :where(.lintel-site-header__nav, .lintel-site-header__button) { display: none; } }
:where(.lintel-mega) { display: flex; gap: var(--lintel-space-2); margin: 0; padding: 0; list-style: none; }
:where(.lintel-mega__link, .lintel-mega__toggle) { display: inline-flex; align-items: center; gap: var(--lintel-space-1); min-block-size: 2.75rem; padding: 0 var(--lintel-space-3); border-radius: var(--lintel-radius-button); color: inherit; text-decoration: none; font-weight: 500; cursor: pointer; list-style: none; }
:where(.lintel-mega__toggle)::-webkit-details-marker { display: none; }
:where(.lintel-mega__link--button) { margin-inline-start: var(--lintel-space-2); }
:where(.lintel-site-header__empty-menu) { margin-inline-start: auto; }
:where(.lintel-empty-menu) { display: inline-flex; align-items: center; gap: var(--lintel-space-1); min-block-size: 2.25rem; padding: 0 var(--lintel-space-3); border: 1px dashed currentColor; border-radius: var(--lintel-radius-button); background: transparent; color: inherit; font: inherit; font-size: 0.875rem; opacity: 0.75; cursor: pointer; }
:where(.lintel-empty-menu:hover) { opacity: 1; }
:where(.lintel-empty-menu__icon) { inline-size: 1rem; block-size: 1rem; }
:where(.lintel-mega__link[aria-current="page"]) { color: var(--lintel-color-brand); }
:where(.lintel-mega__chevron) { inline-size: 1rem; block-size: 1rem; transition: rotate 0.15s; }
:where(.lintel-mega__disclosure[open] .lintel-mega__chevron) { rotate: 180deg; }
:where(.lintel-mega__panel) { position: absolute; inset-inline: var(--lintel-space-5); inset-block-start: 100%; display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--lintel-space-6); padding: var(--lintel-space-6); border-radius: var(--lintel-radius-large, var(--lintel-radius-medium)); background: var(--lintel-color-background); box-shadow: 0 16px 48px rgb(0 0 0 / 0.14); }
:where(.lintel-mega__overview) { grid-column: 1 / -1; font-weight: 600; }
:where(.lintel-mega__column ul) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-mega__column a) { color: inherit; text-decoration: none; }
:where(.lintel-mega__column a:hover) { color: var(--lintel-color-brand); }
:where(.lintel-mega__column-title) { margin-bottom: var(--lintel-space-2); font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--lintel-color-text-secondary); }
:where(.lintel-mega__featured) { display: flex; flex-direction: column; gap: var(--lintel-space-2); color: inherit; text-decoration: none; font-weight: 600; }
:where(.lintel-mega__featured img) { aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--lintel-radius-medium); }
:where(.lintel-drawer__open) { display: inline-flex; align-items: center; gap: var(--lintel-space-2); min-block-size: 2.75rem; padding: 0 var(--lintel-space-3); border: 1px solid var(--lintel-color-border); border-radius: var(--lintel-radius-button); background: transparent; color: inherit; font: inherit; cursor: pointer; }
/* After .lintel-drawer__open, which the Header's menu button also has: same weight, so order decides. */
:where(.lintel-site-header__menu-button) { display: none; margin-inline-start: auto; }
${tablet} { :where(.lintel-site-header__menu-button) { display: inline-flex; } }
:where(.lintel-drawer__icon) { inline-size: 1.25rem; block-size: 1.25rem; }
:where(.lintel-mobile-menu--small-screens) { display: none; }
${tablet} { :where(.lintel-mobile-menu--small-screens) { display: block; } }
:where(.lintel-drawer) { margin: 0 0 0 auto; inline-size: min(24rem, 88vw); max-inline-size: none; block-size: 100dvh; max-block-size: none; padding: var(--lintel-space-5); border: 0; background: var(--lintel-color-background); color: var(--lintel-color-text); }
:where(.lintel-drawer--left) { margin: 0 auto 0 0; }
:where(.lintel-drawer[open]) { display: flex; flex-direction: column; gap: var(--lintel-space-4); animation: lintel-drawer-in 0.2s ease-out; }
:where(.lintel-drawer--left[open]) { animation-name: lintel-drawer-in-left; }
:where(.lintel-drawer)::backdrop { background: rgb(0 0 0 / 0.5); }
@keyframes lintel-drawer-in { from { translate: 100% 0; } }
@keyframes lintel-drawer-in-left { from { translate: -100% 0; } }
:where(.lintel-drawer__close-form) { display: flex; justify-content: flex-end; }
:where(.lintel-drawer__links) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
:where(.lintel-drawer__links a) { display: block; padding: var(--lintel-space-3) 0; color: inherit; text-decoration: none; font-size: 1.125rem; border-bottom: 1px solid var(--lintel-color-border); }
:where(.lintel-drawer__links ul) { list-style: none; padding-inline-start: var(--lintel-space-4); }
:where(.lintel-drawer__links ul a) { font-size: 1rem; }
:where(.lintel-site-footer) { display: flex; flex-direction: column; gap: var(--lintel-space-6); padding: var(--lintel-space-8) var(--lintel-space-5) var(--lintel-space-5); border-top: 1px solid var(--lintel-color-border); }
:where(.lintel-site-footer__columns) { display: grid; gap: var(--lintel-space-6); grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr)); }
:where(.lintel-site-footer__title) { margin-bottom: var(--lintel-space-3); font-weight: 700; }
:where(.lintel-site-footer__column ul) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-site-footer a) { color: inherit; }
:where(.lintel-site-footer__bottom) { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--lintel-space-4); font-size: 0.875rem; color: var(--lintel-color-text-secondary); }
:where(.lintel-language-links) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-3); margin: 0; padding: 0; list-style: none; }
:where(.lintel-language-links [aria-current]) { font-weight: 700; }
:where(.lintel-language-switcher select, .lintel-search-box input, .lintel-product-grid__sort select, .lintel-variant-picker select, .lintel-add-to-cart__quantity input, .lintel-form input, .lintel-form select, .lintel-form textarea, .lintel-newsletter input, .lintel-cart input, .lintel-cart select) {
  min-block-size: 2.75rem; padding: var(--lintel-space-2) var(--lintel-space-3); border: 1px solid var(--lintel-color-border); border-radius: var(--lintel-radius-small, 0.375rem); background: var(--lintel-color-background); color: inherit; font: inherit;
}
:where(.lintel-search-box form) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-search-box__label) { font-weight: 600; }
:where(.lintel-search-box__row, .lintel-newsletter__row) { display: flex; gap: var(--lintel-space-2); }
:where(.lintel-search-box__row input, .lintel-newsletter__row input) { flex: 1; min-inline-size: 0; }
:where(.lintel-search-box__icon) { inline-size: 1.1rem; block-size: 1.1rem; }
${phone} { :where(.lintel-search-box__row span) { display: none; } :where(.lintel-search-box__row span.lintel-search-box__icon) { display: inline; } }
:where(.lintel-back-to-top) { display: inline-flex; align-items: center; gap: var(--lintel-space-2); min-block-size: 2.75rem; padding: 0 var(--lintel-space-4); border-radius: 999px; background: var(--lintel-color-surface); color: inherit; text-decoration: none; font-weight: 600; }
:where(.lintel-back-to-top svg) { inline-size: 1.1rem; block-size: 1.1rem; }
:where(.lintel-back-to-top--floats) { position: fixed; inset-inline-end: var(--lintel-space-5); inset-block-end: var(--lintel-space-5); z-index: 30; box-shadow: 0 6px 20px rgb(0 0 0 / 0.15); transition: opacity 0.2s, translate 0.2s; }
:where(.lintel-back-to-top--floats[data-hidden]) { opacity: 0; translate: 0 1rem; pointer-events: none; }
`;

const formsAndData = `
:where(.lintel-form form) { display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-form__field) { display: flex; flex-direction: column; gap: var(--lintel-space-1); margin: 0; padding: 0; border: 0; }
:where(.lintel-form__label) { font-weight: 600; padding: 0; }
:where(.lintel-form__required) { font-weight: 400; color: var(--lintel-color-text-secondary); }
:where(.lintel-form__hint) { font-size: 0.875rem; color: var(--lintel-color-text-secondary); }
:where(.lintel-form__error) { font-size: 0.875rem; color: #c0392b; font-weight: 600; }
:where(.lintel-form__choice) { display: flex; align-items: center; gap: var(--lintel-space-2); min-block-size: 2.25rem; }
:where(.lintel-form__trap) { position: absolute; inset-inline-start: -10000px; inline-size: 1px; block-size: 1px; overflow: hidden; }
:where(.lintel-form button[type="submit"]) { align-self: flex-start; }
:where(.lintel-form__status:empty) { display: none; }
:where(.lintel-form__status) { padding: var(--lintel-space-3); border-radius: var(--lintel-radius-medium); background: var(--lintel-color-surface); }
:where(.lintel-newsletter) { display: flex; flex-direction: column; gap: var(--lintel-space-3); }
:where(.lintel-newsletter__form) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-newsletter__label) { font-weight: 600; }
:where(.lintel-newsletter__text) { color: var(--lintel-color-text-secondary); }
:where(.lintel-collection-list, .lintel-product-grid) { display: flex; flex-direction: column; gap: var(--lintel-space-5); }
:where(.lintel-collection-list__items, .lintel-product-grid__items) { margin: 0; padding: 0; list-style: none; }
:where(.lintel-collection-list__item) { display: flex; flex-direction: column; min-inline-size: 0; }
:where(.lintel-collection-list__item > *) { flex: 1; }
:where(.lintel-collection-list__empty) { padding: var(--lintel-space-6); border: 1px dashed var(--lintel-color-border); border-radius: var(--lintel-radius-medium); text-align: center; color: var(--lintel-color-text-secondary); }
:where(.lintel-pagination) { display: flex; justify-content: space-between; align-items: center; gap: var(--lintel-space-4); }
:where(.lintel-pagination__where) { color: var(--lintel-color-text-secondary); font-size: 0.875rem; }
`;

const shop = `
:where(.lintel-product-grid__sort) { display: flex; align-items: center; justify-content: flex-end; gap: var(--lintel-space-2); }
:where(.lintel-product-card) { display: flex; flex-direction: column; gap: var(--lintel-space-2); }
:where(.lintel-product-card__link) { display: flex; flex-direction: column; gap: var(--lintel-space-2); color: inherit; text-decoration: none; }
:where(.lintel-product-card__picture) { display: grid; place-items: center; aspect-ratio: 4 / 5; overflow: hidden; border-radius: var(--lintel-radius-medium); background: var(--lintel-color-surface); color: var(--lintel-color-text-secondary); }
:where(.lintel-product-card__picture--square) { aspect-ratio: 1; }
:where(.lintel-product-card__picture--landscape) { aspect-ratio: 4 / 3; }
:where(.lintel-product-card__picture img) { inline-size: 100%; block-size: 100%; object-fit: cover; transition: scale 0.3s ease; }
:where(.lintel-product-card__link:hover img) { scale: 1.03; }
:where(.lintel-product-card__title) { font-weight: 600; }
:where(.lintel-price) { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--lintel-space-2); margin: 0; }
:where(.lintel-price__now) { font-weight: 700; }
:where(.lintel-product-price .lintel-price__now) { font-size: 1.5rem; }
:where(.lintel-price__was) { color: var(--lintel-color-text-secondary); }
:where(.lintel-price__saving) { font-size: 0.8125rem; font-weight: 700; color: #1e7a46; }
:where(.lintel-product-gallery) { display: grid; gap: var(--lintel-space-3); }
:where(.lintel-product-gallery--side) { grid-template-columns: 5rem 1fr; }
:where(.lintel-product-gallery--side .lintel-product-gallery__thumbnails) { order: -1; flex-direction: column; }
:where(.lintel-product-gallery__track) { display: grid; grid-auto-flow: column; grid-auto-columns: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; margin: 0; padding: 0; list-style: none; border-radius: var(--lintel-radius-medium); scrollbar-width: none; }
:where(.lintel-product-gallery__slide) { scroll-snap-align: start; aspect-ratio: 4 / 5; background: var(--lintel-color-surface); display: grid; place-items: center; }
:where(.lintel-product-gallery__slide img) { inline-size: 100%; block-size: 100%; object-fit: cover; }
:where(.lintel-product-gallery__slide--empty svg) { inline-size: 3rem; block-size: 3rem; opacity: 0.4; }
:where(.lintel-product-gallery__thumbnails) { display: flex; gap: var(--lintel-space-2); margin: 0; padding: 0; list-style: none; overflow-x: auto; }
:where(.lintel-product-gallery__thumbnail) { display: block; inline-size: 4.5rem; aspect-ratio: 1; border: 2px solid transparent; border-radius: var(--lintel-radius-small, 0.375rem); overflow: hidden; }
:where(.lintel-product-gallery__thumbnail[aria-current="true"]) { border-color: var(--lintel-color-brand); }
:where(.lintel-product-gallery__thumbnail img) { inline-size: 100%; block-size: 100%; object-fit: cover; }
${phone} { :where(.lintel-product-gallery--side) { grid-template-columns: 1fr; } :where(.lintel-product-gallery--side .lintel-product-gallery__thumbnails) { order: 0; flex-direction: row; } }
:where(.lintel-variant-picker) { display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-variant-picker__option) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-2); margin: 0; padding: 0; border: 0; }
:where(.lintel-variant-picker__option legend, .lintel-variant-picker__option label:not(.lintel-variant-picker__choice)) { inline-size: 100%; margin-bottom: var(--lintel-space-1); font-weight: 600; }
:where(.lintel-variant-picker__choice) { position: relative; }
:where(.lintel-variant-picker__choice input) { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; }
:where(.lintel-variant-picker__choice span) { display: inline-flex; align-items: center; min-block-size: 2.75rem; min-inline-size: 2.75rem; justify-content: center; padding: 0 var(--lintel-space-3); border: 1px solid var(--lintel-color-border); border-radius: var(--lintel-radius-button); }
:where(.lintel-variant-picker__choice input:checked + span) { border-color: var(--lintel-color-text); box-shadow: inset 0 0 0 1px var(--lintel-color-text); font-weight: 600; }
:where(.lintel-variant-picker__choice input:focus-visible + span) { outline: 2px solid var(--lintel-color-brand); outline-offset: 2px; }
:where(.lintel-variant-picker__choice input[data-unavailable] + span) { text-decoration: line-through; opacity: 0.55; }
:where(.lintel-add-to-cart) { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--lintel-space-3); }
:where(.lintel-add-to-cart__quantity) { display: flex; flex-direction: column; gap: var(--lintel-space-1); font-size: 0.875rem; font-weight: 600; }
:where(.lintel-add-to-cart__quantity input) { inline-size: 5rem; }
:where(.lintel-add-to-cart__button) { flex: 1; min-inline-size: 10rem; }
:where(.lintel-add-to-cart__status) { inline-size: 100%; font-size: 0.875rem; }
:where(.lintel-add-to-cart__status:empty) { display: none; }
:where(.lintel-cart-button__open) { position: relative; display: inline-flex; align-items: center; justify-content: center; inline-size: 2.75rem; block-size: 2.75rem; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; }
:where(.lintel-cart-button__count) { position: absolute; inset-block-start: 0; inset-inline-end: 0; min-inline-size: 1.25rem; block-size: 1.25rem; padding: 0 0.3rem; border-radius: 999px; background: var(--lintel-color-brand); color: var(--lintel-color-on-brand); font-size: 0.75rem; font-weight: 700; line-height: 1.25rem; }
:where(.lintel-cart-button__count[data-empty]) { display: none; }
:where(.lintel-cart:not(dialog), .lintel-cart[open]) { display: flex; flex-direction: column; gap: var(--lintel-space-4); }
:where(.lintel-cart__title) { font-size: 1.5rem; }
:where(.lintel-cart__contents) { flex: 1; overflow-y: auto; }
:where(.lintel-cart__lines) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
:where(.lintel-cart__line) { display: grid; grid-template-columns: 4.5rem 1fr auto; gap: var(--lintel-space-3); align-items: start; padding: var(--lintel-space-3) 0; border-bottom: 1px solid var(--lintel-color-border); }
:where(.lintel-cart__line img, .lintel-cart__line-picture) { inline-size: 4.5rem; aspect-ratio: 1; object-fit: cover; border-radius: var(--lintel-radius-small, 0.375rem); background: var(--lintel-color-surface); }
:where(.lintel-cart__line-picture) { display: grid; place-items: center; color: var(--lintel-color-text-secondary); }
:where(.lintel-cart__line-picture svg) { inline-size: 1.5rem; block-size: 1.5rem; opacity: 0.4; }
:where(.lintel-cart__line-name) { font-weight: 600; }
:where(.lintel-cart__line-detail, .lintel-cart__problem) { font-size: 0.875rem; color: var(--lintel-color-text-secondary); }
:where(.lintel-cart__problem) { color: #c0392b; }
:where(.lintel-cart__line-actions) { display: flex; align-items: center; gap: var(--lintel-space-2); }
:where(.lintel-cart__line-actions input) { inline-size: 4rem; }
:where(.lintel-cart__remove) { border: 0; background: none; color: var(--lintel-color-text-secondary); text-decoration: underline; cursor: pointer; font: inherit; font-size: 0.875rem; min-block-size: 2.75rem; }
:where(.lintel-cart__totals) { display: grid; grid-template-columns: 1fr auto; gap: var(--lintel-space-1) var(--lintel-space-4); }
:where(.lintel-cart__totals dt) { color: var(--lintel-color-text-secondary); }
:where(.lintel-cart__totals dd) { margin: 0; text-align: end; font-weight: 600; }
:where(.lintel-cart__discount:not([hidden])) { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--lintel-space-3); }
:where(.lintel-cart__discount label) { display: flex; flex: 1; flex-direction: column; gap: var(--lintel-space-1); min-inline-size: 12rem; font-weight: 600; font-size: 0.875rem; }
:where(.lintel-cart__discount-problems, .lintel-cart__codes) { inline-size: 100%; margin: 0; font-size: 0.875rem; }
:where(.lintel-cart__discount-problems) { color: var(--lintel-color-text-secondary); }
:where(.lintel-cart__codes) { display: flex; flex-wrap: wrap; gap: var(--lintel-space-3); padding: 0; list-style: none; }
:where(.lintel-cart__discount-problems:empty, .lintel-cart__codes:empty) { display: none; }
:where(.lintel-cart__code) { display: inline-flex; align-items: center; gap: var(--lintel-space-2); font-weight: 600; }
:where(.lintel-cart__checkout-form) { display: grid; gap: var(--lintel-space-3); grid-template-columns: repeat(2, minmax(0, 1fr)); }
:where(.lintel-cart__checkout-form label:not(.lintel-form__choice), .lintel-cart__rates legend) { display: flex; flex-direction: column; gap: var(--lintel-space-1); font-weight: 600; font-size: 0.875rem; }
:where(.lintel-cart__rates) { margin: 0; padding: 0; border: 0; }
:where(.lintel-cart__rates:not([hidden])) { display: grid; gap: var(--lintel-space-1); }
:where(.lintel-cart__rates legend) { margin-bottom: var(--lintel-space-1); padding: 0; }
:where(.lintel-cart__checkout-form .lintel-cart__wide) { grid-column: 1 / -1; }
${phone} { :where(.lintel-cart__checkout-form) { grid-template-columns: 1fr; } }
:where(.lintel-cart__message) { padding: var(--lintel-space-3); border-radius: var(--lintel-radius-medium); background: var(--lintel-color-surface); }
:where(.lintel-cart__message:empty) { display: none; }
:where(.lintel-order-confirmation) { display: flex; flex-direction: column; align-items: center; gap: var(--lintel-space-4); padding: var(--lintel-space-8) var(--lintel-space-5); text-align: center; }
:where(.lintel-order-confirmation__icon) { inline-size: 3.5rem; block-size: 3.5rem; color: #1e7a46; }
`;

const reducedMotion = `
@media (prefers-reduced-motion: reduce) {
  :where(.lintel-marquee__list, .lintel-logos--scrolls .lintel-logos__list, .lintel-icon svg) { animation: none; }
  :where(.lintel-marquee__list[aria-hidden], .lintel-logos--scrolls .lintel-logos__list[aria-hidden]) { display: none; }
  :where(.lintel-marquee__track, .lintel-marquee__list) { flex-wrap: wrap; inline-size: auto; white-space: normal; }
  :where(.lintel-carousel__track, .lintel-product-gallery__track) { scroll-behavior: auto; }
  :where(.lintel-drawer[open]) { animation: none; }
  :where(.lintel-card--linked, .lintel-product-card__picture img) { transition: none; }
}
`;

export const elementStylesheet = [
  layout,
  effectElementsStylesheet,
  media,
  text,
  navigation,
  formsAndData,
  shop,
  reducedMotion,
]
  .map((part) => part.trim())
  .join("\n");
