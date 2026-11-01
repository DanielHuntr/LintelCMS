import type { Ref } from "react";
import { useDocumentTitle } from "../branding/useDocumentTitle.js";

interface DisplayTitleProps {
  id?: string;
  ref?: Ref<HTMLHeadingElement>;
  /** Set to -1 when focus is moved to the heading, e.g. as a new setup screen appears. */
  tabIndex?: number;
  children: string;
}

/**
 * The page's h1 on full-screen screens such as setup and sign-in: one large, confident
 * question or statement. Admin pages use LargeTitle instead.
 */
export function DisplayTitle({ id, ref, tabIndex, children }: DisplayTitleProps) {
  useDocumentTitle(children);
  return (
    <h1
      id={id}
      ref={ref}
      tabIndex={tabIndex}
      className="text-[2rem] leading-[2.5rem] font-semibold tracking-[-0.026em] text-balance text-label outline-none sm:text-display"
    >
      {children}
    </h1>
  );
}
