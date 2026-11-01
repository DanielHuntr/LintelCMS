import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Lets people drop files anywhere on `target` (the whole window when it's left out) and
 * reports whether files are being dragged over it, for the drop overlay. Dragging text or
 * a link is ignored, as is everything while `enabled` is false.
 */
export function useFileDrop(
  onDrop: (files: File[]) => void,
  { enabled = true, target }: { enabled?: boolean; target?: RefObject<HTMLElement | null> } = {},
): boolean {
  const [isDragging, setIsDragging] = useState(false);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });

  useEffect(() => {
    const element: HTMLElement | Window | null = target ? target.current : window;
    if (!enabled || !element) return;

    // dragenter and dragleave fire for every child crossed, so count them to know when
    // the pointer has really left.
    let depth = 0;

    function carriesFiles(event: DragEvent) {
      return event.dataTransfer?.types.includes("Files") ?? false;
    }
    function handleDragEnter(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setIsDragging(true);
    }
    function handleDragOver(event: DragEvent) {
      if (!carriesFiles(event)) return;
      // Without this the browser opens the file instead of letting us have it.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }
    function handleDragLeave(event: DragEvent) {
      if (!carriesFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsDragging(false);
    }
    function handleDrop(event: DragEvent) {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      depth = 0;
      setIsDragging(false);
      const files = [...(event.dataTransfer?.files ?? [])];
      if (files.length > 0) onDropRef.current(files);
    }

    const listeners = [
      ["dragenter", handleDragEnter],
      ["dragover", handleDragOver],
      ["dragleave", handleDragLeave],
      ["drop", handleDrop],
    ] as const;
    for (const [type, listener] of listeners) {
      element.addEventListener(type, listener as EventListener);
    }
    return () => {
      for (const [type, listener] of listeners) {
        element.removeEventListener(type, listener as EventListener);
      }
      setIsDragging(false);
    };
  }, [enabled, target]);

  return isDragging;
}
