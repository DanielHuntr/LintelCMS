import { clockComponent, clockPlaceName, formatClockTime } from "@lintel/builder-model";
import { drawsProps } from "../component-registry.js";
import { cx } from "./behaviour-types.js";

/**
 * The live clock: the place's name and the time there. On the canvas it shows the time as
 * it is drawn; on the website the elements script fills it in and keeps it current, since
 * a page saved hours ago would otherwise show the wrong time.
 */
const Clock = drawsProps(clockComponent, ({ props, attributes, mode }) => {
  const place = props.label || clockPlaceName(props.zone);
  const hours = props.hours === "12" ? "12" : "24";
  return (
    <p
      {...attributes}
      className={cx(attributes.className, "lintel-clock")}
      data-behaviour="clock"
      data-zone={props.zone}
      data-hours={hours}
    >
      {place && <span className="lintel-clock__place">{place}</span>}
      <time className="lintel-clock__time">
        {mode === "canvas" ? formatClockTime(new Date(), props.zone, hours) : "--:--"}
      </time>
    </p>
  );
});

export const clockRenders = { clock: Clock };

export const clockStylesheet = `
:where(.lintel-clock) { display: inline-flex; align-items: baseline; gap: 0.5em; margin: 0; font-variant-numeric: tabular-nums; }
:where(.lintel-clock__place) { color: var(--lintel-color-text-secondary); }
`;
