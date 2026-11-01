/**
 * The script that runs inside the canvas frame. It draws the page it is sent, outlines the
 * selected and hovered elements, and reports clicks, hovering, text typed in place, pasting
 * and keyboard shortcuts back to the builder.
 *
 * It is written as one self-contained function so it can be put into the frame as text
 * (`canvasFrameSource`): it must not use anything from outside its own body.
 */
export function runCanvasFrame(): void {
  const builder = window.parent;
  const send = (message: Record<string, unknown>) => builder.postMessage(message, "*");
  const pageStyle = document.getElementById("lintel-page-style") as HTMLStyleElement;
  const root = document.getElementById("lintel-page") as HTMLElement;
  const overlay = document.getElementById("lintel-overlay") as HTMLElement;
  let outline: {
    selectedId: string | null;
    hoveredId: string | null;
    labels: { selected: string | null; hovered: string | null };
  } = {
    selectedId: null,
    hoveredId: null,
    labels: { selected: null, hovered: null },
  };
  let editing: HTMLElement | null = null;
  let editingOriginal = "";

  const nodeElement = (nodeId: string | null) =>
    nodeId
      ? (root.querySelector(`[data-lintel-node="${CSS.escape(nodeId)}"]`) as HTMLElement | null)
      : null;
  const nodeIdAt = (target: EventTarget | null) => {
    const element = target instanceof Element ? target.closest("[data-lintel-node]") : null;
    return element ? element.getAttribute("data-lintel-node") : null;
  };

  function drawBox(nodeId: string | null, kind: string, label: string | null) {
    const element = nodeElement(nodeId);
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const box = document.createElement("div");
    box.className = `lintel-outline lintel-outline--${kind}`;
    box.style.left = `${rect.left + window.scrollX}px`;
    box.style.top = `${rect.top + window.scrollY}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
    if (label) {
      const tag = document.createElement("span");
      tag.className = "lintel-outline__label";
      tag.textContent = label;
      box.appendChild(tag);
    }
    overlay.appendChild(box);
  }

  function drawOutlines() {
    overlay.replaceChildren();
    if (outline.hoveredId && outline.hoveredId !== outline.selectedId) {
      drawBox(outline.hoveredId, "hover", outline.labels.hovered);
    }
    drawBox(outline.selectedId, "selected", outline.labels.selected);
  }

  function finishEditing(keep: boolean) {
    const element = editing;
    if (!element) return;
    editing = null;
    element.removeAttribute("contenteditable");
    const text = (element.innerText || "").replace(/\n$/, "");
    if (!keep) {
      element.innerText = editingOriginal;
      return;
    }
    const nodeId = nodeIdAt(element);
    const prop = element.getAttribute("data-lintel-text");
    if (nodeId && prop && text !== editingOriginal) send({ type: "editText", nodeId, prop, text });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== builder) return;
    const message = event.data as { type?: string; html?: string; css?: string; nodeId?: string };
    if (message.type === "render" && typeof message.html === "string") {
      if (editing) return;
      pageStyle.textContent = message.css ?? "";
      root.innerHTML = message.html;
      requestAnimationFrame(drawOutlines);
    } else if (message.type === "outline") {
      outline = event.data as typeof outline;
      drawOutlines();
    } else if (message.type === "reveal" && message.nodeId) {
      nodeElement(message.nodeId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  document.addEventListener("click", (event) => {
    event.preventDefault();
    if (editing && editing.contains(event.target as Node)) return;
    finishEditing(true);
    send({ type: "select", nodeId: nodeIdAt(event.target) });
  });

  document.addEventListener("dblclick", (event) => {
    const target =
      event.target instanceof Element
        ? (event.target.closest("[data-lintel-text]") as HTMLElement | null)
        : null;
    if (!target) return;
    event.preventDefault();
    editing = target;
    editingOriginal = target.innerText;
    target.setAttribute("contenteditable", "plaintext-only");
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });

  document.addEventListener("focusout", (event) => {
    if (editing && event.target === editing) finishEditing(true);
  });

  let lastHovered: string | null = null;
  document.addEventListener("mousemove", (event) => {
    const nodeId = nodeIdAt(event.target);
    if (nodeId === lastHovered) return;
    lastHovered = nodeId;
    send({ type: "hover", nodeId });
  });
  document.addEventListener("mouseleave", () => {
    lastHovered = null;
    send({ type: "hover", nodeId: null });
  });

  document.addEventListener("keydown", (event) => {
    if (editing) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishEditing(false);
      } else if (event.key === "Enter" && !event.shiftKey && editing.tagName !== "P") {
        event.preventDefault();
        finishEditing(true);
      }
      return;
    }
    const { key, metaKey, ctrlKey, shiftKey, altKey } = event;
    if (key === "Tab") return;
    event.preventDefault();
    send({ type: "key", key: { key, metaKey, ctrlKey, shiftKey, altKey } });
  });

  document.addEventListener("paste", (event) => {
    if (editing) return;
    event.preventDefault();
    send({
      type: "paste",
      html: event.clipboardData?.getData("text/html") ?? "",
      text: event.clipboardData?.getData("text/plain") ?? "",
    });
  });

  window.addEventListener("resize", drawOutlines);
  window.addEventListener("scroll", drawOutlines, { passive: true });
  new ResizeObserver(drawOutlines).observe(root);
  send({ type: "ready" });
}

/** Styles only the canvas has: the outlines, and placeholders for empty things. */
const canvasStyles = `
#lintel-overlay { position: absolute; inset: 0 auto auto 0; pointer-events: none; z-index: 2147483647; }
.lintel-outline { position: absolute; box-sizing: border-box; }
.lintel-outline--selected { outline: 2px solid #7539fd; outline-offset: -1px; }
.lintel-outline--hover { outline: 1px solid #7539fd; outline-offset: -1px; opacity: 0.8; }
.lintel-outline__label { position: absolute; left: -1px; bottom: 100%; padding: 1px 6px; font: 600 11px/16px -apple-system, system-ui, sans-serif; color: #fff; background: #7539fd; border-radius: 4px 4px 0 0; white-space: nowrap; }
.lintel-outline--hover .lintel-outline__label { opacity: 0.9; }
[data-lintel-placeholder="image"] { min-height: 12rem; background: repeating-linear-gradient(135deg, #ececf1 0 12px, #f5f5f7 12px 24px); border-radius: 12px; }
[data-lintel-placeholder="unknown"] { min-height: 3rem; background: #fff4e5; }
[data-lintel-node]:empty:not(img, hr, br, [data-lintel-placeholder]) { min-height: 4rem; outline: 1px dashed #c7c7cc; outline-offset: -1px; }
[contenteditable] { outline: 2px solid #7539fd; outline-offset: 2px; cursor: text; }
a { cursor: default; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;

/**
 * The frame's script as a file of its own. A host with a Content-Security-Policy that
 * refuses inline scripts (the admin's does) serves this text at an address of its own and
 * passes that address as `frameScriptUrl`, since a frame drawn from `srcdoc` inherits the
 * policy of the page around it.
 */
export function canvasFrameScript(): string {
  return `(${runCanvasFrame.toString()})();\n`;
}

/**
 * The frame's whole document (the page itself arrives by message): the script inline by
 * default, or loaded from `frameScriptUrl`.
 */
export function canvasFrameSource(frameScriptUrl?: string): string {
  const script = frameScriptUrl
    ? `<script src="${frameScriptUrl.replaceAll('"', "&quot;")}"></script>`
    : `<script>${canvasFrameScript()}</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style id="lintel-page-style"></style><style>${canvasStyles}</style></head><body><div id="lintel-page"></div><div id="lintel-overlay"></div>${script}</body></html>`;
}
