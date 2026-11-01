import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, type ReactNode } from "react";
import { BackLink } from "../design/BackLink.js";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "../design/Button.js";

/**
 * Links and navigation for plugin screens. The admin's own links are checked against its
 * route list; plugin screens are added while the admin runs (see PluginScreenRoute), so
 * these take any address.
 */

interface PluginLinkProps {
  to: string;
  className?: string;
  children: ReactNode;
  /** Draws the link as a button, for actions that go to another screen ("New booking"). */
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export function PluginLink({ to, className, children, variant, size, icon }: PluginLinkProps) {
  const looksLikeButton = variant !== undefined;
  return (
    <Link
      to={to as "/"}
      className={looksLikeButton ? buttonClasses(variant, size ?? "medium") : className}
    >
      {icon && <span className="-ml-0.5 flex [&>svg]:size-[1.1em]">{icon}</span>}
      {children}
    </Link>
  );
}

/** "‹ Bookings" above a page title, back to a plugin screen (or any other). */
export function PluginBackLink({ to, children }: { to: string; children: string }) {
  return <BackLink to={to as "/"}>{children}</BackLink>;
}

/** `navigate("/bookings")`, for after a save. */
export function usePluginNavigate(): (to: string) => Promise<void> {
  const navigate = useNavigate();
  return useCallback((to: string) => navigate({ to: to as "/" }), [navigate]);
}
