import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

type BackLinkProps = Omit<LinkComponentProps<"a">, "className" | "children"> & {
  /** The name of the screen it goes back to, e.g. "Settings". */
  children: string;
};

/** "‹ Settings" above a page title, for screens one level below a section. */
export function BackLink({ children, ...linkProps }: BackLinkProps) {
  return (
    <Link
      {...linkProps}
      className="-ms-1.5 mb-1 inline-flex h-7 items-center gap-0.5 rounded-control pe-2 ps-0.5 text-body text-accent transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
    >
      <ChevronLeft aria-hidden="true" strokeWidth={2.25} className="size-[18px]" />
      {children}
    </Link>
  );
}
