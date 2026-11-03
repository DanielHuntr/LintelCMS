import type { Breakpoint } from "@lintel/builder-model";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import type { MotionSpec } from "@lintel/motion";
import type { EffectBinding } from "@lintel/motion/effects";
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
  type SceneMarkers,
} from "./canvas-messages.js";
import {
  clampZoom,
  fitZoom,
  stepZoom,
  zoomFromWheel,
  zoomKey,
  type ZoomKey,
} from "./canvas-zoom.js";

/**
 * An animation to play on the canvas, or an effect to run there until the preview stops;
 * a new `playId` plays it again.
 */
export type MotionPreview =
  | { nodeId: string; spec: MotionSpec; playId: number }
  | {
      nodeId: string;
      effect: Pick<EffectBinding, "module" | "behaviour" | "params">;
      modules: Readonly<Record<string, string>>;
      playId: number;
    };

/** The page's width at the smaller screen sizes, in pixels. */
const frameWidths: Record<Exclude<Breakpoint, "base">, number> = { tablet: 768, phone: 390 };

/** Keys typed into these are text, not shortcuts. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

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
  /** Elements outlined together, such as everything using a shared style. */
  highlightIds?: readonly string[];
  labels: OutlineLabels;
  /** Scrolls an element into view, e.g. after picking it in the Layers panel. */
  revealId: string | null;
  /** Whether the selected element can be turned and dragged (it isn't locked). */
  canTransform: boolean;
  /** Whether elements can be dragged to new places; false where only content may change. */
  canMove?: boolean;
  site?: CanvasSite;
  /** Where the frame's scripts are served (see `canvasFrameScript`); inline when left out. */
  scripts?: CanvasScriptAddresses;
  motionPreview?: MotionPreview | null;
  /** Where something dragged from Insert would land, drawn as a line. */
  insertMarker?: InsertMarker | null;
  /** Something from Insert is being dragged, so the page accepts it being dropped. */
  isInsertDragging?: boolean;
  /** The selected element's scroll scene lines, or null for none. */
  sceneMarkers?: SceneMarkers | null;
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
  highlightIds,
  labels,
  revealId,
  canTransform,
  canMove = true,
  site,
  scripts,
  motionPreview = null,
  insertMarker = null,
  isInsertDragging = false,
  sceneMarkers = null,
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

  // Zoom and pan: the page keeps its width (and so its layout); its frame is scaled.
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panLayer = useRef<HTMLDivElement>(null);
  const panFrom = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    const measure = () =>
      // The padding (p-4) on both sides isn't room for the page.
      setRoom({ width: element.clientWidth - 32, height: element.clientHeight - 32 });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const frameWidth = breakpoint === "base" ? room.width : frameWidths[breakpoint];
  const applyZoomKey = useCallback(
    (action: ZoomKey) =>
      setZoom((current) =>
        action === "in" || action === "out"
          ? stepZoom(current, action)
          : action === "fit"
            ? fitZoom(frameWidth, room.width)
            : 1,
      ),
    [frameWidth, room.width],
  );
  const startPanning = useCallback(() => {
    const element = area.current;
    if (!element) return false;
    const canScroll =
      element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight;
    if (canScroll) setIsPanning(true);
    return canScroll;
  }, []);
  const latestZoomKeys = useRef({ applyZoomKey, startPanning });
  useEffect(() => {
    latestZoomKeys.current = { applyZoomKey, startPanning };
  });
  useEffect(() => {
    if (isPanning) panLayer.current?.focus();
  }, [isPanning]);
  // In the builder around the frame: the same keys, unless something is being typed.
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (isTyping(event.target)) return;
      const action = zoomKey(event);
      if (action) {
        event.preventDefault();
        latestZoomKeys.current.applyZoomKey(action);
      } else if (event.key === " " && !event.repeat && latestZoomKeys.current.startPanning()) {
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", keyDown);
    return () => window.removeEventListener("keydown", keyDown);
  }, []);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readFrameMessage(event.data);
      if (!message) return;
      if (message.type === "ready") setReadySource(latestSource.current);
      if (message.type === "zoomWheel") {
        setZoom((current) => zoomFromWheel(current, message.deltaY));
        return;
      }
      // Zoom keys and Space pressed while the page has focus are the canvas's, not shortcuts.
      if (message.type === "key") {
        const action = zoomKey(message.key);
        if (action) {
          latestZoomKeys.current.applyZoomKey(action);
          return;
        }
        const plain = !message.key.ctrlKey && !message.key.metaKey && !message.key.altKey;
        if (message.key.key === " " && plain && latestZoomKeys.current.startPanning()) return;
      }
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
      post({
        type: "outline",
        selectedId,
        hoveredId,
        highlightIds,
        labels,
        canTransform,
        canMove,
        rotateLabel,
      });
    }
  }, [
    isReady,
    selectedId,
    hoveredId,
    highlightIds,
    labels,
    html,
    breakpoint,
    canTransform,
    canMove,
    rotateLabel,
  ]);

  useEffect(() => {
    if (isReady && revealId) post({ type: "reveal", nodeId: revealId });
  }, [isReady, revealId]);

  useEffect(() => {
    if (isReady) post({ type: "insertMarker", marker: insertMarker });
  }, [isReady, insertMarker]);

  useEffect(() => {
    if (isReady) post({ type: "insertDragging", active: isInsertDragging });
  }, [isReady, isInsertDragging]);

  useEffect(() => {
    if (isReady) post({ type: "sceneMarkers", markers: sceneMarkers });
  }, [isReady, sceneMarkers, html]);

  // After the page is drawn (the render above waits a frame), so the element is there.
  useEffect(() => {
    if (!isReady) return;
    const handle = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        post(
          !motionPreview
            ? { type: "stopMotion" }
            : "spec" in motionPreview
              ? { type: "previewMotion", nodeId: motionPreview.nodeId, spec: motionPreview.spec }
              : {
                  type: "previewEffect",
                  nodeId: motionPreview.nodeId,
                  binding: motionPreview.effect,
                  modules: motionPreview.modules,
                },
        ),
      ),
    );
    return () => cancelAnimationFrame(handle);
  }, [isReady, motionPreview]);

  // At actual size the frame fills the space as before; zoomed, it is drawn at the page's
  // width and scaled, taller when zoomed out so more of the page shows.
  const isZoomed = zoom !== 1 && frameWidth > 0;
  const frameHeight = Math.max(480, room.height / Math.min(zoom, 1));
  const percent = Math.round(zoom * 100);
  const zoomButton =
    "flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-caption font-medium text-label hover:bg-fill focus-visible:focus-ring";

  return (
    <div className="relative flex min-h-0 flex-1">
      <div
        ref={area}
        data-testid="canvas-area"
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          setZoom((current) => zoomFromWheel(current, event.deltaY));
        }}
        className="flex min-h-0 flex-1 justify-center overflow-auto bg-background p-4"
      >
        <div
          style={
            isZoomed
              ? { width: frameWidth * zoom, height: frameHeight * zoom }
              : { width: canvasWidths[breakpoint] }
          }
          className={
            isZoomed
              ? "relative shrink-0"
              : "relative h-full min-h-[480px] max-w-full shrink-0 transition-[width] duration-200 ease-standard"
          }
        >
          {/*
            Out of the Tab order, with everything in it: the page's links and buttons go nowhere
            while designing (LINTEL-A11Y-029). Clicks still select, and the keyboard way to
            each element is Layers.
          */}
          <iframe
            ref={frame}
            tabIndex={-1}
            data-tour="canvas"
            title={text("pageBuilder.canvas.title")}
            srcDoc={source}
            sandbox="allow-scripts"
            style={
              isZoomed
                ? {
                    width: frameWidth,
                    height: frameHeight,
                    transform: `scale(${zoom})`,
                    transformOrigin: "0 0",
                  }
                : undefined
            }
            className={
              isZoomed
                ? "absolute top-0 left-0 rounded-card bg-surface shadow-float"
                : "size-full rounded-card bg-surface shadow-float"
            }
          />
          {/*
          Browsers don't carry a drag from the builder into the sandboxed frame, so while
          something from Insert is dragged, this catches it over the page and tells the frame
          where the pointer is.
        */}
          {isInsertDragging && (
            <div
              data-testid="canvas-drop-layer"
              className="absolute inset-0"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                const box = frame.current?.getBoundingClientRect();
                if (box) {
                  // The frame's own pixels, whatever the zoom.
                  const scale = isZoomed ? zoom : 1;
                  post({
                    type: "insertPoint",
                    x: (event.clientX - box.left) / scale,
                    y: (event.clientY - box.top) / scale,
                  });
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  latestOnMessage.current({ type: "insertLeave" });
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                latestOnMessage.current({ type: "insertDrop" });
              }}
            />
          )}
        </div>
      </div>
      {isPanning && (
        // Over the page while Space is held: dragging moves around it.
        <div
          ref={panLayer}
          tabIndex={-1}
          role="application"
          aria-label={text("pageBuilder.zoom.panHint")}
          title={text("pageBuilder.zoom.panHint")}
          onKeyUp={(event) => {
            if (event.key === " ") setIsPanning(false);
          }}
          onBlur={() => setIsPanning(false)}
          onPointerDown={(event) => {
            const element = area.current;
            if (!element) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            panFrom.current = {
              x: event.clientX,
              y: event.clientY,
              left: element.scrollLeft,
              top: element.scrollTop,
            };
          }}
          onPointerMove={(event) => {
            const from = panFrom.current;
            const element = area.current;
            if (!from || !element) return;
            element.scrollLeft = from.left - (event.clientX - from.x);
            element.scrollTop = from.top - (event.clientY - from.y);
          }}
          onPointerUp={() => {
            panFrom.current = null;
          }}
          className="absolute inset-0 z-10 cursor-grab outline-none active:cursor-grabbing"
        />
      )}
      <div
        role="group"
        aria-label={text("pageBuilder.zoom.label")}
        className="absolute right-4 bottom-4 z-20 flex items-center gap-0.5 rounded-full bg-surface p-0.5 shadow-float"
      >
        <button
          type="button"
          onClick={() => setZoom((current) => stepZoom(current, "out"))}
          aria-label={text("pageBuilder.zoom.out")}
          title={text("pageBuilder.zoom.out")}
          className={zoomButton}
        >
          <Minus aria-hidden="true" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          aria-label={text("pageBuilder.zoom.actual", { percent })}
          title={text("pageBuilder.zoom.actual", { percent })}
          className={`${zoomButton} w-12 tabular-nums`}
        >
          {percent}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((current) => stepZoom(current, "in"))}
          aria-label={text("pageBuilder.zoom.in")}
          title={text("pageBuilder.zoom.in")}
          className={zoomButton}
        >
          <Plus aria-hidden="true" className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(clampZoom(fitZoom(frameWidth, room.width)))}
          title={text("pageBuilder.zoom.fitHint")}
          className={zoomButton}
        >
          {text("pageBuilder.zoom.fit")}
        </button>
      </div>
    </div>
  );
}
