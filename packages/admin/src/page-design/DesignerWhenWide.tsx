import { type ReactNode, useState } from "react";

/**
 * The designer, or a note saying it needs a bigger screen. A designer already open stays open
 * but hidden while the window is too narrow, so narrowing the window for a moment loses
 * nothing: what is selected, an open panel, or code being written in the shader code box.
 */
export function DesignerWhenWide({
  isNarrowScreen,
  note,
  children,
}: {
  isNarrowScreen: boolean;
  note: ReactNode;
  children: ReactNode;
}) {
  const [hasOpened, setHasOpened] = useState(!isNarrowScreen);
  if (!isNarrowScreen && !hasOpened) setHasOpened(true);
  if (!hasOpened) return note;
  return (
    <>
      {isNarrowScreen && note}
      <div className={isNarrowScreen ? "hidden" : "contents"}>{children}</div>
    </>
  );
}
