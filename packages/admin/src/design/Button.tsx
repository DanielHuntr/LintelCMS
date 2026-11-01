import type { ButtonHTMLAttributes, ReactNode } from "react";
import { classNames } from "./classNames.js";

export type ButtonVariant = "filled" | "tinted" | "plain" | "destructive";
export type ButtonSize = "small" | "medium" | "large" | "extra-large";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * filled for the one main action on a screen, tinted for secondary actions, plain for the rest.
   * destructive is for confirming something that deletes; it is tinted red rather than filled,
   * because white text on the dark-mode red doesn't reach AA contrast.
   */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the width of the container, as on the sign-in card. */
  fullWidth?: boolean;
  /** An icon shown before the text, e.g. `<Plus aria-hidden />` from lucide-react. */
  icon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  filled: "bg-accent-fill text-on-accent hover:bg-accent-fill-hover active:brightness-95",
  tinted: "bg-accent/12 text-accent hover:bg-accent/18",
  plain: "text-accent hover:bg-fill",
  destructive: "bg-danger/14 text-danger hover:bg-danger/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  small: "h-7 gap-1.5 rounded-full px-3 text-footnote font-medium",
  medium: "h-9 gap-2 rounded-control px-4 text-body font-medium",
  large: "h-11 gap-2 rounded-card px-5 text-headline",
  "extra-large": "h-[52px] gap-2 rounded-card px-7 text-headline",
};

/** The classes behind a Button, for things that must look like one but aren't, such as links. */
export function buttonClasses(
  variant: ButtonVariant = "filled",
  size: ButtonSize = "medium",
): string {
  return classNames(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none",
    "transition duration-150 ease-standard focus-visible:focus-ring",
    "motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
    variantClasses[variant],
    sizeClasses[size],
  );
}

export function Button({
  variant = "filled",
  size = "medium",
  fullWidth = false,
  icon,
  type = "button",
  className,
  children,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(buttonClasses(variant, size), fullWidth && "w-full", className)}
      {...buttonProps}
    >
      {icon && <span className="-ms-0.5 flex [&>svg]:size-[1.1em]">{icon}</span>}
      {children}
    </button>
  );
}
