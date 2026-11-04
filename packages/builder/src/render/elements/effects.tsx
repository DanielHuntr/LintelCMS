import {
  arcCarouselComponent,
  cardStackComponent,
  counterRowComponent,
  cylinderGalleryComponent,
  magneticButtonComponent,
  notificationToastComponent,
  radialMenuComponent,
  scrollingRowComponent,
  toggleSwitchComponent,
} from "@lintel/builder-model";
import { drawsProps } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * The ready-made animated elements. Each is plain, readable HTML on its own; the effects it
 * starts with (see effect-components.ts in builder-model) add the motion on the website.
 */

const MagneticButton = drawsProps(
  magneticButtonComponent,
  ({ props, attributes, editableText }) => (
    <a
      {...attributes}
      href={props.href || undefined}
      className={cx(attributes.className, "lintel-button", "lintel-magnetic-button")}
      {...editableText("text")}
    >
      {props.text}
    </a>
  ),
);

const CardStack = drawsProps(cardStackComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-card-stack")}
    aria-label={props.label || undefined}
  >
    {children}
  </div>
));

const CylinderGallery = drawsProps(cylinderGalleryComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-cylinder-gallery")}
    aria-label={props.label || undefined}
  >
    {children}
  </div>
));

const ArcCarousel = drawsProps(arcCarouselComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-arc-carousel")}
    aria-label={props.label || undefined}
  >
    {children}
  </div>
));

const ScrollingRow = drawsProps(scrollingRowComponent, ({ props, attributes, children }) => (
  <div
    {...attributes}
    className={cx(attributes.className, "lintel-scrolling-row")}
    aria-label={props.label || undefined}
  >
    {children}
  </div>
));

const CounterRow = drawsProps(counterRowComponent, ({ attributes, children }) => (
  <div {...attributes} className={cx(attributes.className, "lintel-counter-row")}>
    {children}
  </div>
));

/** A real button, announced as a switch, whose first child is the knob the effect moves. */
const ToggleSwitch = drawsProps(toggleSwitchComponent, ({ props, attributes, editableText }) => (
  <span className="lintel-toggle-field">
    <button
      {...attributes}
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      className={cx(attributes.className, "lintel-toggle")}
    >
      <span className="lintel-toggle__knob" />
    </button>
    <span className="lintel-toggle__label" aria-hidden="true" {...editableText("label")}>
      {props.label}
    </span>
  </span>
));

/** The links are a plain list after the button, so they work as links without scripts. */
const RadialMenu = drawsProps(radialMenuComponent, ({ props, attributes }) => (
  <nav
    {...attributes}
    className={cx(attributes.className, "lintel-radial-menu")}
    aria-label={props.label}
  >
    <button type="button" className="lintel-radial-menu__button" aria-expanded="false">
      <span aria-hidden="true">+</span>
      <span className="lintel-visually-hidden">{props.label}</span>
    </button>
    <ul className="lintel-radial-menu__links">
      {props.links.map((link, index) => (
        <li key={index}>
          <a href={link.href || undefined} className="lintel-radial-menu__link">
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  </nav>
));

/** On the canvas it sits in the page so it can be edited; on the site it floats at a corner. */
const NotificationToast = drawsProps(
  notificationToastComponent,
  ({ props, attributes, mode, editableText }) => (
    <div
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-toast",
        mode === "site" && `lintel-toast--${props.corner}`,
      )}
    >
      <p className="lintel-toast__title" {...editableText("title")}>
        {props.title}
      </p>
      <p className="lintel-toast__message" {...editableText("message")}>
        {props.message}
      </p>
      <button type="button" className="lintel-toast__close" aria-label={props.closeLabel}>
        <span aria-hidden="true">×</span>
      </button>
    </div>
  ),
);

export const effectRenders = {
  magneticButton: MagneticButton,
  cardStack: CardStack,
  cylinderGallery: CylinderGallery,
  arcCarousel: ArcCarousel,
  scrollingRow: ScrollingRow,
  counterRow: CounterRow,
  toggleSwitch: ToggleSwitch,
  radialMenu: RadialMenu,
  notificationToast: NotificationToast,
};

export const effectElementsStylesheet = `
:where(.lintel-magnetic-button) { transition: scale 200ms ease-out; }
:where(.lintel-card-stack) { display: grid; gap: var(--lintel-space-4); }
:where(.lintel-cylinder-gallery) { display: flex; gap: var(--lintel-space-4); overflow-x: auto; }
:where(.lintel-arc-carousel) { display: flex; align-items: center; gap: var(--lintel-space-4); overflow-x: auto; }
.lintel-arc-carousel:empty { display: none !important; }
:where(.lintel-scrolling-row) { display: flex; gap: var(--lintel-space-6); overflow-x: auto; }
:where(.lintel-counter-row) { display: grid; gap: var(--lintel-space-6); }
:where(.lintel-toggle-field) { display: inline-flex; align-items: center; gap: var(--lintel-space-3); }
:where(.lintel-toggle) {
  position: relative; display: inline-block; width: 3.25rem; height: 1.75rem; padding: 0.125rem;
  border: 0; border-radius: 999px; background: var(--lintel-color-border, #ccc); cursor: pointer;
  transition: background-color 200ms;
}
:where(.lintel-toggle[aria-checked="true"]) { background: var(--lintel-color-brand); }
:where(.lintel-toggle__knob) {
  display: block; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
}
:where(.lintel-toggle:focus-visible) { outline: 2px solid var(--lintel-color-brand); outline-offset: 2px; }
:where(.lintel-radial-menu) { position: relative; display: inline-grid; place-items: center; }
:where(.lintel-radial-menu__button) {
  display: grid; place-items: center; width: 3.5rem; height: 3.5rem; border: 0; border-radius: 50%; cursor: pointer;
  background: var(--lintel-color-brand); color: var(--lintel-color-on-brand, #fff); font-size: 1.5rem;
}
:where(.lintel-radial-menu__links) { list-style: none; margin: var(--lintel-space-2) 0 0; padding: 0; display: flex; gap: var(--lintel-space-2); }
:where(.lintel-radial-menu__link) {
  display: inline-grid; place-items: center; min-width: 3rem; min-height: 3rem; padding: 0 var(--lintel-space-2);
  border-radius: 999px; background: var(--lintel-color-surface, #fff); color: inherit; text-decoration: none;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); font-size: 0.8rem; font-weight: 600;
}
:where(.lintel-toast) {
  position: relative; max-width: 22rem; padding: var(--lintel-space-4) var(--lintel-space-6) var(--lintel-space-4) var(--lintel-space-4);
  border-radius: var(--lintel-radius-card, 12px); background: var(--lintel-color-surface, #fff);
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.16);
}
:where(.lintel-toast--bottom-right, .lintel-toast--bottom-left, .lintel-toast--top-right, .lintel-toast--top-left) { position: fixed; z-index: 1000; }
:where(.lintel-toast--bottom-right) { right: 1.5rem; bottom: 1.5rem; }
:where(.lintel-toast--bottom-left) { left: 1.5rem; bottom: 1.5rem; }
:where(.lintel-toast--top-right) { right: 1.5rem; top: 1.5rem; }
:where(.lintel-toast--top-left) { left: 1.5rem; top: 1.5rem; }
:where(.lintel-toast__title) { margin: 0 0 var(--lintel-space-1); font-weight: 600; }
:where(.lintel-toast__message) { margin: 0; }
:where(.lintel-toast__close) {
  position: absolute; top: var(--lintel-space-2); right: var(--lintel-space-2); width: 2rem; height: 2rem;
  border: 0; border-radius: 50%; background: transparent; color: inherit; font-size: 1.25rem; cursor: pointer;
}
`;
