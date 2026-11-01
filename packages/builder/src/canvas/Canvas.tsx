import type { Breakpoint } from "@lintel/builder-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { canvasFrameSource } from "./canvas-frame-script.js";
import {
  type MessageFromFrame,
  type MessageToFrame,
  type OutlineLabels,
  readFrameMessage,
} from "./canvas-messages.js";

/** How wide the canvas is at each screen size; desktop fills the space there is. */
export const canvasWidths: Record<Breakpoint, string> = {
  base: "100%",
  tablet: "768px",
  phone: "390px",
};

interface CanvasProps {
  /** Where the frame's script is served (see `canvasFrameScript`); inline when left out. */
  frameScriptUrl?: string;
  html: string;
  css: string;
  breakpoint: Breakpoint;
  selectedId: string | null;
  hoveredId: string | null;
  labels: OutlineLabels;
  /** Scrolls an element into view, e.g. after picking it in the Layers panel. */
  revealId: string | null;
  onMessage: (message: MessageFromFrame) => void;
}

/**
 * The page as visitors will see it, drawn in a sandboxed frame from the real HTML and CSS.
 * The frame has scripts (its own, for selecting and editing) but no same-origin access, so
 * nothing on the page can reach the admin.
 */
export function Canvas({
  html,
  css,
  breakpoint,
  selectedId,
  hoveredId,
  labels,
  revealId,
  onMessage,
  frameScriptUrl,
}: CanvasProps) {
  const text = useBuilderText();
  const frame = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const source = useMemo(() => canvasFrameSource(frameScriptUrl), [frameScriptUrl]);
  const latestOnMessage = useRef(onMessage);

  useEffect(() => {
    latestOnMessage.current = onMessage;
  });

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readFrameMessage(event.data);
      if (!message) return;
      if (message.type === "ready") setIsReady(true);
      latestOnMessage.current(message);
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  const post = (message: MessageToFrame) => frame.current?.contentWindow?.postMessage(message, "*");

  // Drawing a 300-element page takes a few milliseconds; waiting for the next frame means a
  // burst of changes (dragging a slider) is drawn once per screen refresh, not once per change.
  useEffect(() => {
    if (!isReady) return;
    const handle = requestAnimationFrame(() => post({ type: "render", html, css }));
    return () => cancelAnimationFrame(handle);
  }, [isReady, html, css]);

  useEffect(() => {
    if (isReady) post({ type: "outline", selectedId, hoveredId, labels });
  }, [isReady, selectedId, hoveredId, labels, html, breakpoint]);

  useEffect(() => {
    if (isReady && revealId) post({ type: "reveal", nodeId: revealId });
  }, [isReady, revealId]);

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-background p-4">
      <iframe
        ref={frame}
        title={text("pageBuilder.canvas.title")}
        srcDoc={source}
        sandbox="allow-scripts"
        style={{ width: canvasWidths[breakpoint] }}
        className="h-full min-h-[480px] max-w-full shrink-0 rounded-card bg-surface shadow-float transition-[width] duration-200 ease-standard"
      />
    </div>
  );
}
