import type { Breakpoint } from "@lintel/builder-model";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { MotionSpec } from "@lintel/motion";
import {
  type CanvasScriptAddresses,
  type CanvasSite,
  canvasFrameSource,
} from "./canvas-frame-script.js";
import {
  type MessageFromFrame,
  type MessageToFrame,
  type OutlineLabels,
  readFrameMessage,
  type InsertMarker,
} from "./canvas-messages.js";

/** An animation to play on the canvas; a new `playId` plays it again. */
export interface MotionPreview {
  nodeId: string;
  spec: MotionSpec;
  playId: number;
}

/** How wide the canvas is at each screen size; desktop fills the space there is. */
export const canvasWidths: Record<Breakpoint, string> = {
  base: "100%",
  tablet: "768px",
  phone: "390px",
};

interface CanvasProps {
  html: string;
  css: string;
  breakpoint: Breakpoint;
  selectedId: string | null;
  hoveredId: string | null;
  labels: OutlineLabels;
  /** Scrolls an element into view, e.g. after picking it in the Layers panel. */
  revealId: string | null;
  /** Whether the selected element can be turned and dragged (it isn't locked). */
  canTransform: boolean;
  site?: CanvasSite;
  /** Where the frame's scripts are served (see `canvasFrameScript`); inline when left out. */
  scripts?: CanvasScriptAddresses;
  motionPreview?: MotionPreview | null;
  /** Where something dragged from Insert would land, drawn as a line. */
  insertMarker?: InsertMarker | null;
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
  canTransform,
  site,
  scripts,
  motionPreview = null,
  insertMarker = null,
  onMessage,
}: CanvasProps) {
  const text = useBuilderText();
  const frame = useRef<HTMLIFrameElement>(null);
  const source = useMemo(() => canvasFrameSource(site, scripts), [site, scripts]);
  // A new document (the site's look arrived) is a new frame, which says again when it's ready.
  const [readySource, setReadySource] = useState<string | null>(null);
  const isReady = readySource === source;
  const latestSource = useRef(source);
  const latestOnMessage = useRef(onMessage);

  useEffect(() => {
    latestOnMessage.current = onMessage;
    latestSource.current = source;
  });

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readFrameMessage(event.data);
      if (!message) return;
      if (message.type === "ready") setReadySource(latestSource.current);
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

  const rotateLabel = text("pageBuilder.design.rotateHandle");
  useEffect(() => {
    if (isReady) {
      post({ type: "outline", selectedId, hoveredId, labels, canTransform, rotateLabel });
    }
  }, [isReady, selectedId, hoveredId, labels, html, breakpoint, canTransform, rotateLabel]);

  useEffect(() => {
    if (isReady && revealId) post({ type: "reveal", nodeId: revealId });
  }, [isReady, revealId]);

  useEffect(() => {
    if (isReady) post({ type: "insertMarker", marker: insertMarker });
  }, [isReady, insertMarker]);

  // After the page is drawn (the render above waits a frame), so the element is there.
  useEffect(() => {
    if (!isReady) return;
    const handle = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        post(
          motionPreview
            ? { type: "previewMotion", nodeId: motionPreview.nodeId, spec: motionPreview.spec }
            : { type: "stopMotion" },
        ),
      ),
    );
    return () => cancelAnimationFrame(handle);
  }, [isReady, motionPreview]);

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-background p-4">
      <iframe
        ref={frame}
        data-tour="canvas"
        title={text("pageBuilder.canvas.title")}
        srcDoc={source}
        sandbox="allow-scripts"
        style={{ width: canvasWidths[breakpoint] }}
        className="h-full min-h-[480px] max-w-full shrink-0 rounded-card bg-surface shadow-float transition-[width] duration-200 ease-standard"
      />
    </div>
  );
}
