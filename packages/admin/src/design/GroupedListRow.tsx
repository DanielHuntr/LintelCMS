import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "./classNames.js";
import type { Tone } from "./tones.js";

interface GroupedListRowProps {
  label: string;
  /** A second, quieter line under the label. */
  description?: string;
  /** Lets a long label and description wrap instead of being cut short, as in settings. */
  wrapsText?: boolean;
  /** A short value on the right, e.g. the current language "English". */
  detail?: string;
  icon?: LucideIcon;
  iconTone?: Tone;
  /** A control or status on the right, such as a Toggle or a Badge. */
  accessory?: ReactNode;
  /** Makes the row a link to another admin screen, with a disclosure chevron. */
  to?: string;
  /** Makes the row a button, with a disclosure chevron. Ignored when `to` is set. */
  onSelect?: () => void;
}

const iconToneClasses: Record<Tone, string> = {
  neutral: "bg-label-tertiary",
  accent: "bg-accent-fill",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** One row of a GroupedList. */
export function GroupedListRow({
  label,
  description,
  wrapsText = false,
  detail,
  icon: Icon,
  iconTone = "accent",
  accessory,
  to,
  onSelect,
}: GroupedListRowProps) {
  const isNavigable = to !== undefined || onSelect !== undefined;

  const content = (
    <>
      {Icon && (
        <span
          className={classNames(
            "flex size-7 shrink-0 items-center justify-center rounded-[7px] text-on-accent",
            iconToneClasses[iconTone],
          )}
        >
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </span>
      )}
      {/*
        Rows after the first get a separator. It sits on this inner part (li + li > row > here),
        so it starts at the label rather than the edge, as in iOS.
      */}
      <span className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li+li>*>&]:hairline-top">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={classNames("text-body text-label", !wrapsText && "truncate")}>
            {label}
          </span>
          {description && (
            <span
              className={classNames("text-footnote text-label-secondary", !wrapsText && "truncate")}
            >
              {description}
            </span>
          )}
        </span>
        {detail && <span className="text-body text-label-secondary">{detail}</span>}
        {accessory}
        {isNavigable && (
          <ChevronRight
            aria-hidden="true"
            strokeWidth={2}
            className="-mr-1 size-4 shrink-0 text-label-tertiary"
          />
        )}
      </span>
    </>
  );

  const rowClasses = "flex w-full items-center gap-3 pl-4 text-left";
  const interactiveClasses = classNames(
    rowClasses,
    "transition-colors duration-150 ease-standard hover:bg-fill/60 active:bg-fill",
    "focus-visible:focus-ring-inset",
  );

  if (to !== undefined) {
    return (
      <li>
        <Link to={to} className={interactiveClasses}>
          {content}
        </Link>
      </li>
    );
  }

  if (onSelect !== undefined) {
    return (
      <li>
        <button type="button" onClick={onSelect} className={interactiveClasses}>
          {content}
        </button>
      </li>
    );
  }

  return (
    <li>
      <div className={rowClasses}>{content}</div>
    </li>
  );
}
