import { model3dComponent } from "@lintel/builder-model";
import { drawsProps } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * The 3D model element. On its own it is a picture: the model's poster, or a quiet cube
 * until there is one, named for screen readers by its description. The "model-viewer"
 * effect (see impliedModelEffect) draws the model over it on the page and the canvas.
 */

const Model3d = drawsProps(model3dComponent, ({ props, attributes, mode }) =>
  // Visitors never see an element still waiting for its model.
  mode === "site" && !props.model.src && !props.poster ? null : (
    <figure
      {...attributes}
      className={cx(
        attributes.className,
        "lintel-model",
        props.motion === "drag" && "lintel-model--drag",
      )}
      role="img"
      aria-label={props.alt.trim() || "3D model"}
    >
      {props.poster ? (
        <img className="lintel-model__poster" src={props.poster} alt="" decoding="async" />
      ) : (
        <svg
          className="lintel-model__placeholder"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M12 2.5 3.5 7v10l8.5 4.5 8.5-4.5V7z" />
          <path d="m3.5 7 8.5 4.5L20.5 7M12 11.5v10" />
        </svg>
      )}
    </figure>
  ),
);

export const modelRenders = { model3d: Model3d };

export const modelElementStylesheet = `
:where(.lintel-model) { position: relative; display: block; margin: 0; overflow: hidden; inline-size: 100%; aspect-ratio: 1; }
:where(.lintel-model__poster) { display: block; inline-size: 100%; block-size: 100%; object-fit: contain; }
:where(.lintel-model__placeholder) {
  position: absolute; inset: 0; margin: auto; inline-size: 30%; block-size: 30%;
  fill: none; stroke: currentColor; stroke-width: 1; stroke-linejoin: round; opacity: 0.3;
}
:where(.lintel-model--drag[data-model-ready]) { cursor: grab; touch-action: pan-y; }
:where(.lintel-model--drag[data-model-ready]:active) { cursor: grabbing; }
:where(.lintel-model:focus-visible) { outline: 2px solid var(--lintel-color-brand); outline-offset: 2px; }
`;
