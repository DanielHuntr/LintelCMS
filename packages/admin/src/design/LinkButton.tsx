import { Link, type LinkComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./Button.js";
import { classNames } from "./classNames.js";

type LinkButtonProps = Omit<LinkComponentProps<"a">, "className" | "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
};

/**
 * A link that looks like a Button. Use it when the action goes to another screen
 * ("New entry"), so it behaves as a link: it can open in a new tab and is announced as one.
 */
export function LinkButton({
  variant = "filled",
  size = "medium",
  icon,
  children,
  ...linkProps
}: LinkButtonProps) {
  return (
    <Link {...linkProps} className={classNames(buttonClasses(variant, size))}>
      {icon && <span className="-ms-0.5 flex [&>svg]:size-[1.1em]">{icon}</span>}
      {children}
    </Link>
  );
}
