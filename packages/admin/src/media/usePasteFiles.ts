import { useEffect, useRef } from "react";
import { filesFrom, isWritingTarget } from "./pastedFiles.js";

/**
 * Pasting files anywhere on the page (Cmd/Ctrl+V after copying a picture or taking a
 * screenshot) hands them over, as dropping them does. Pastes into text areas and rich text
 * are left alone, and so is everything while `enabled` is false.
 */
export function usePasteFiles(onPaste: (files: File[]) => void, { enabled = true } = {}): void {
  const onPasteRef = useRef(onPaste);
  useEffect(() => {
    onPasteRef.current = onPaste;
  });

  useEffect(() => {
    if (!enabled) return;
    function handlePaste(event: ClipboardEvent) {
      if (event.defaultPrevented || isWritingTarget(event.target)) return;
      const files = filesFrom(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      onPasteRef.current(files);
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [enabled]);
}
