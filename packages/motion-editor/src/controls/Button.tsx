import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames.js";

/*
 * The studio's buttons, matching the admin's design system (packages/admin/src/design).
 * The studio is its own package so the builder can embed it, so it carries its own copies
 * of the few controls it needs, built from the same tokens.
 */

type Variant = "filled" | "tinted" | "plain";

const variantClasses: Record<Variant, string> = {
  filled: "bg-accent-fill text-on-accent hover:brightness-110 active:brightness-95",
  tinted: "bg-accent/12 text-accent hover:bg-accent/18",
  plain: "text-accent hover:bg-fill",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  /** For icon-only buttons: the text screen readers hear, also shown as a tooltip. */
  label?: string;
}

export function Button({
  variant = "tinted",
  icon,
  label,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-label={children ? undefined : label}
      title={children ? undefined : label}
      className={classNames(
        "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full text-footnote font-medium whitespace-nowrap select-none",
        children ? "px-3" : "w-7",
        "transition duration-150 ease-standard focus-visible:focus-ring motion-safe:active:scale-[0.97]",
        "disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon && <span className="flex [&>svg]:size-[1.1em]">{icon}</span>}
      {children}
    </button>
  );
}
