import { snapBox } from "../free-layout/snapping.js";

/**
 * The script that runs inside the canvas frame. It draws the page it is sent, outlines the
 * selected and hovered elements, and reports clicks, hovering, text typed in place, the
 * part of a text that is selected, pasting and keyboard shortcuts back to the builder.
 *
 * It also lets people turn the selected element with the round handle above it, and drag
 * elements around a free layout (snapping to edges and to each other, with guide lines;
 * Alt while dragging turns snapping off), or nudge them with the arrow keys (Shift for ten
 * pixels). The element moves on the canvas straight away; the new angle or place is sent
 * when the pointer is let go.
 *
 * Pictures dragged in from the computer, or pasted, are sent to the builder as files, for
 * the Picture element under the pointer (or the selected one).
 *
 * Any element can be dragged to a new place on the page, with the same line showing where it
 * would go (Escape calls it off). Something dragged from Insert can be dropped on the page: the frame says what the pointer
 * is over, the builder works out where it would land, and the frame draws that line.
 *
 * It is written as one self-contained function so it can be put into the frame as text
 * (`canvasFrameSource`): it must not use anything from outside its own body, except
 * `snap`, which is passed in the same way.
 */
export function runCanvasFrame(snap: typeof snapBox): void {
  interface Preview {
    destroy(): void;
  }
  interface Runtime {
    mountMotion(
      element: HTMLElement,
      spec: unknown,
      options: { mode: "manual"; nodeAttribute: string },
    ): Preview & { restart(): void };
    mountEffect?(element: HTMLElement, binding: unknown): Promise<() => void>;
    setEffectModuleAddresses?(addresses: Record<string, string>): void;
  }
  const builder = window.parent;
  const send = (message: Record<string, unknown>) => builder.postMessage(message, "*");
  const pageStyle = document.getElementById("lintel-page-style") as HTMLStyleElement;
  const root = document.getElementById("lintel-page") as HTMLElement;
  const overlay = document.getElementById("lintel-overlay") as HTMLElement;
  let outline: {
    selectedId: string | null;
    hoveredId: string | null;
    labels: { selected: string | null; hovered: string | null };
    canTransform: boolean;
    rotateLabel: string;
  } = {
    selectedId: null,
    hoveredId: null,
    labels: { selected: null, hovered: null },
    canTransform: false,
    rotateLabel: "",
  };
  let editing: HTMLElement | null = null;
  let editingOriginal = "";
  // A page drawn while text was being typed waits until the typing is finished.
  let waitingRender: { html: string; css: string } | null = null;
  let rotating: {
    element: HTMLElement;
    nodeId: string;
    centreX: number;
    centreY: number;
    startAngle: number;
    startRotation: number;
    degrees: number;
  } | null = null;
  let dragging: {
    element: HTMLElement;
    nodeId: string;
    container: HTMLElement;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
    left: number;
    top: number;
  } | null = null;
  // Where something dragged from Insert would land, as the builder worked it out.
  let insertMarker: { nodeId: string; position: string; across: boolean } | null = null;
  let lastInsertOver = "";
  // An element being dragged to a new place in the page's flow (not a free layout).
  let moving: {
    element: HTMLElement;
    nodeId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null = null;
  // A click straight after a move would select whatever is under the pointer; it's ignored.
  let justMoved = false;
  // Told by the builder while something from Insert is being dragged.
  let insertDragging = false;
  // The animation being previewed, if any. Stopped before the page is drawn again.
  let preview: Preview | null = null;
  const stopPreview = () => {
    preview?.destroy();
    preview = null;
  };

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
    if (rotating || dragging?.moved) return;
    overlay.replaceChildren();
    if (outline.hoveredId && outline.hoveredId !== outline.selectedId) {
      drawBox(outline.hoveredId, "hover", outline.labels.hovered);
    }
    drawBox(outline.selectedId, "selected", outline.labels.selected);
    drawRotateHandle();
    drawInsertMarker();
  }

  function drawInsertMarker() {
    if (!insertMarker) return;
    const element = nodeElement(insertMarker.nodeId) ?? root;
    const rect = element.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = rect.top + window.scrollY;
    const mark = document.createElement("div");
    if (insertMarker.position === "inside") {
      mark.className = "lintel-drop lintel-drop--inside";
      Object.assign(mark.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
      });
    } else {
      const isAfter = insertMarker.position === "after";
      mark.className = "lintel-drop lintel-drop--line";
      Object.assign(
        mark.style,
        insertMarker.across
          ? {
              left: `${(isAfter ? left + rect.width : left) - 1.5}px`,
              top: `${top}px`,
              width: "3px",
              height: `${rect.height}px`,
            }
          : {
              left: `${left}px`,
              top: `${(isAfter ? top + rect.height : top) - 1.5}px`,
              width: `${rect.width}px`,
              height: "3px",
            },
      );
    }
    overlay.appendChild(mark);
  }

  function drawRotateHandle() {
    const element = nodeElement(outline.selectedId);
    if (!element || !outline.canTransform || editing) return;
    const rect = element.getBoundingClientRect();
    const handle = document.createElement("div");
    handle.className = "lintel-rotate-handle";
    handle.title = outline.rotateLabel;
    handle.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    handle.style.top = `${rect.top + window.scrollY - 28}px`;
    overlay.appendChild(handle);
  }

  /** The text as stored: text as it is, and a line break for each <br>. */
  function plainText(holder: Node): string {
    let text = "";
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
      else if (node.nodeName === "BR") text += "\n";
      else node.childNodes.forEach(walk);
    };
    walk(holder);
    return text;
  }

  /** How many characters of `holder`'s stored text come before a point in it. */
  function offsetIn(holder: Node, container: Node, offset: number): number {
    const range = document.createRange();
    range.selectNodeContents(holder);
    range.setEnd(container, offset);
    return plainText(range.cloneContents()).length;
  }

  let lastSelection = "";
  function reportSelection() {
    const selection = window.getSelection();
    let report: Record<string, unknown> = { type: "textSelection", nodeId: null };
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const start =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      const holder = start?.closest("[data-lintel-text]") as HTMLElement | null;
      const nodeId = holder ? nodeIdAt(holder) : null;
      if (holder && nodeId) {
        report = {
          type: "textSelection",
          nodeId,
          prop: holder.getAttribute("data-lintel-text"),
          from: offsetIn(holder, range.startContainer, range.startOffset),
          to: offsetIn(holder, range.endContainer, range.endOffset),
          text: plainText(holder),
        };
      }
    }
    const key = JSON.stringify(report);
    if (key === lastSelection) return;
    lastSelection = key;
    send(report);
  }

  function clearGuides() {
    overlay.querySelectorAll(".lintel-guide").forEach((guide) => guide.remove());
  }

  function drawGuides(
    container: HTMLElement,
    guides: Array<{ axis: "x" | "y"; position: number }>,
  ) {
    clearGuides();
    const rect = container.getBoundingClientRect();
    const originX = rect.left + window.scrollX + container.clientLeft;
    const originY = rect.top + window.scrollY + container.clientTop;
    for (const guide of guides) {
      const line = document.createElement("div");
      line.className = `lintel-guide lintel-guide--${guide.axis}`;
      if (guide.axis === "x") {
        line.style.left = `${originX + guide.position}px`;
        line.style.top = `${originY}px`;
        line.style.height = `${container.clientHeight}px`;
      } else {
        line.style.left = `${originX}px`;
        line.style.top = `${originY + guide.position}px`;
        line.style.width = `${container.clientWidth}px`;
      }
      overlay.appendChild(line);
    }
  }

  /** The selected element when it sits in a free layout and can be moved, or null. */
  function freeElement(
    nodeId: string | null,
  ): { element: HTMLElement; container: HTMLElement } | null {
    const element = nodeElement(nodeId);
    const container = element?.parentElement;
    if (!element || !container || !container.hasAttribute("data-lintel-free")) return null;
    return getComputedStyle(element).position === "absolute" ? { element, container } : null;
  }

  // How the selected element looks, so the style panel can show the real size and alignment
  // when nothing is set on the element itself.
  function sendLook() {
    const nodeId = outline.selectedId;
    const element = nodeId ? nodeElement(nodeId) : null;
    if (!nodeId || !element) return;
    const style = getComputedStyle(element);
    send({
      type: "look",
      nodeId,
      textAlign: style.textAlign,
      fontSize: Number.parseFloat(style.fontSize) || 16,
      fontWeight: style.fontWeight,
      color: style.color,
    });
  }

  function sendPlace(nodeId: string, container: HTMLElement, left: number, top: number) {
    const width = container.clientWidth;
    const height = container.clientHeight;
    send({
      type: "place",
      nodeId,
      left: width > 0 ? (left / width) * 100 : 0,
      top: height > 0 ? (top / height) * 100 : 0,
    });
  }

  function drawPage(html: string, css: string) {
    stopPreview();
    pageStyle.textContent = css;
    root.innerHTML = html;
    restoreSelection();
    requestAnimationFrame(drawOutlines);
  }

  /** The text node and offset `offset` characters into a holder's stored text. */
  function pointAt(holder: Node, offset: number): { node: Node; offset: number } {
    let remaining = offset;
    let found: { node: Node; offset: number } | null = null;
    const walk = (node: Node) => {
      if (found) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const length = (node.textContent ?? "").length;
        if (remaining <= length) found = { node, offset: remaining };
        else remaining -= length;
      } else if (node.nodeName === "BR") {
        remaining -= 1;
      } else {
        node.childNodes.forEach(walk);
      }
    };
    walk(holder);
    return found ?? { node: holder, offset: holder.childNodes.length };
  }

  /** After the page is drawn again, the same words are selected as before, so more styles can follow. */
  function restoreSelection() {
    const previous = lastSelection ? (JSON.parse(lastSelection) as Record<string, unknown>) : null;
    if (!previous || typeof previous.nodeId !== "string") return;
    const element = nodeElement(previous.nodeId);
    const holder =
      element?.getAttribute("data-lintel-text") === previous.prop
        ? element
        : element?.querySelector(`[data-lintel-text="${String(previous.prop)}"]`);
    if (!holder) return;
    const start = pointAt(holder, Number(previous.from));
    const end = pointAt(holder, Number(previous.to));
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  function finishEditing(keep: boolean) {
    const element = editing;
    if (!element) return;
    editing = null;
    element.removeAttribute("contenteditable");
    const text = plainText(element).replace(/\n$/, "");
    const nodeId = nodeIdAt(element);
    const prop = element.getAttribute("data-lintel-text");
    if (keep && nodeId && prop && text !== editingOriginal) {
      send({ type: "editText", nodeId, prop, text });
    }
    if (!keep) element.innerText = editingOriginal;
    if (waitingRender) {
      drawPage(waitingRender.html, waitingRender.css);
      waitingRender = null;
    }
  }

  const insertDragType = "application/x-lintel-insert";
  const isInsertDrag = (event: DragEvent) =>
    insertDragging || Array.from(event.dataTransfer?.types ?? []).includes(insertDragType);

  /** Tells the builder what's under the pointer at `clientX`, `clientY`, and around it. */
  function reportInsertOver(target: EventTarget | null, clientX: number, clientY: number) {
    const chain = pointerChain(target, clientX, clientY);
    const key = chain.map((over) => `${over.nodeId}:${Math.round(over.ratio * 20)}`).join("|");
    if (key === lastInsertOver) return;
    lastInsertOver = key;
    if (moving) send({ type: "moveOver", nodeId: moving.nodeId, chain });
    else send({ type: "insertOver", chain });
  }

  /** The element under the pointer and each one around it, with where the pointer is in it. */
  function pointerChain(target: EventTarget | null, clientX: number, clientY: number) {
    // The element under the pointer and each one around it, with where the pointer is in it.
    const chain: Array<{ nodeId: string; ratio: number; across: boolean }> = [];
    let element = target instanceof Element ? target.closest("[data-lintel-node]") : null;
    while (element instanceof HTMLElement && chain.length < 64) {
      const rect = element.getBoundingClientRect();
      const parent = element.parentElement ? getComputedStyle(element.parentElement) : null;
      const across =
        parent !== null &&
        ((parent.display.includes("flex") && parent.flexDirection.startsWith("row")) ||
          (parent.display.includes("grid") &&
            parent.gridTemplateColumns.trim().split(/\s+/).length > 1));
      const ratio = across
        ? (clientX - rect.left) / Math.max(rect.width, 1)
        : (clientY - rect.top) / Math.max(rect.height, 1);
      chain.push({ nodeId: element.getAttribute("data-lintel-node") ?? "", ratio, across });
      element = element.parentElement?.closest("[data-lintel-node]") ?? null;
    }
    return chain;
  }

  document.addEventListener("dragover", (event) => {
    if (!isInsertDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    reportInsertOver(event.target, event.clientX, event.clientY);
  });
  document.addEventListener("dragleave", (event) => {
    if (event.relatedTarget !== null || !isInsertDrag(event)) return;
    lastInsertOver = "";
    send({ type: "insertLeave" });
  });
  document.addEventListener("drop", (event) => {
    if (!isInsertDrag(event)) return;
    event.preventDefault();
    lastInsertOver = "";
    send({ type: "insertDrop" });
  });

  // Files dragged in from the computer: the browser would open them in place of the page, so
  // they are always caught. Pictures dropped on an element go to the builder, which puts
  // them into a Picture element and says so; the element under the pointer is outlined.
  const carriesFiles = (event: DragEvent) =>
    !isInsertDrag(event) && Array.from(event.dataTransfer?.types ?? []).includes("Files");
  document.addEventListener("dragover", (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    const nodeId = nodeIdAt(event.target);
    if (nodeId !== outline.hoveredId) send({ type: "hover", nodeId });
  });
  document.addEventListener("drop", (event) => {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).slice(0, 10);
    if (files.length > 0) send({ type: "dropFiles", nodeId: nodeIdAt(event.target), files });
  });

  window.addEventListener("message", (event) => {
    if (event.source !== builder) return;
    const message = event.data as {
      type?: string;
      html?: string;
      css?: string;
      nodeId?: string;
      spec?: unknown;
      binding?: unknown;
      modules?: Record<string, string>;
    };
    if (message.type === "render" && typeof message.html === "string") {
      if (editing) {
        waitingRender = { html: message.html, css: message.css ?? "" };
        return;
      }
      drawPage(message.html, message.css ?? "");
      sendLook();
    } else if (message.type === "insertPoint") {
      const point = event.data as { x?: unknown; y?: unknown };
      if (typeof point.x === "number" && typeof point.y === "number") {
        reportInsertOver(document.elementFromPoint(point.x, point.y), point.x, point.y);
      }
    } else if (message.type === "insertDragging") {
      insertDragging = (event.data as { active?: unknown }).active === true;
      if (!insertDragging) lastInsertOver = "";
    } else if (message.type === "insertMarker") {
      insertMarker = (event.data as { marker: typeof insertMarker }).marker;
      drawOutlines();
    } else if (message.type === "outline") {
      const previous = outline.selectedId;
      outline = event.data as typeof outline;
      drawOutlines();
      if (outline.selectedId !== previous) sendLook();
    } else if (message.type === "reveal" && message.nodeId) {
      nodeElement(message.nodeId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else if (message.type === "previewMotion" && message.nodeId) {
      stopPreview();
      const runtime = (window as unknown as { lintelMotion?: Runtime }).lintelMotion;
      const element = nodeElement(message.nodeId);
      if (!runtime || !element) return;
      element.scrollIntoView({ block: "nearest" });
      // Manual: the preview plays now, whatever would start it on the site.
      const motion = runtime.mountMotion(element, message.spec, {
        mode: "manual",
        nodeAttribute: "data-lintel-node",
      });
      preview = motion;
      motion.restart();
    } else if (message.type === "previewEffect" && message.nodeId) {
      stopPreview();
      const runtime = (window as unknown as { lintelMotion?: Runtime }).lintelMotion;
      const element = nodeElement(message.nodeId);
      if (!runtime?.mountEffect || !element) return;
      runtime.setEffectModuleAddresses?.(message.modules ?? {});
      element.scrollIntoView({ block: "nearest" });
      // The module may still be loading when the preview is stopped: undo it as it arrives.
      let undo: (() => void) | null = null;
      let stopped = false;
      preview = {
        destroy: () => {
          stopped = true;
          undo?.();
        },
      };
      void runtime.mountEffect(element, message.binding).then((cleanup) => {
        if (stopped) cleanup();
        else undo = cleanup;
      });
    } else if (message.type === "stopMotion") {
      stopPreview();
    }
  });

  document.addEventListener("click", (event) => {
    event.preventDefault();
    if (justMoved) {
      justMoved = false;
      return;
    }
    if (event.target instanceof Element && event.target.closest(".lintel-rotate-handle")) return;
    if (editing && editing.contains(event.target as Node)) return;
    finishEditing(true);
    send({ type: "select", nodeId: nodeIdAt(event.target) });
    const openMenu =
      event.target instanceof Element ? event.target.closest("[data-lintel-open-menu]") : null;
    if (openMenu)
      send({ type: "openMenu", nodeId: openMenu.getAttribute("data-lintel-open-menu") });
  });

  document.addEventListener("dblclick", (event) => {
    const target =
      event.target instanceof Element
        ? (event.target.closest("[data-lintel-text]") as HTMLElement | null)
        : null;
    if (!target) return;
    event.preventDefault();
    editing = target;
    editingOriginal = plainText(target);
    drawOutlines();
    target.setAttribute("contenteditable", "plaintext-only");
    target.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  });

  document.addEventListener("selectionchange", reportSelection);

  document.addEventListener("pointerdown", (event) => {
    if (editing || event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target.closest(".lintel-rotate-handle")) {
      const element = nodeElement(outline.selectedId);
      if (!element || !outline.selectedId) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const centreX = rect.left + rect.width / 2;
      const centreY = rect.top + rect.height / 2;
      const startRotation = Number.parseFloat(getComputedStyle(element).rotate) || 0;
      rotating = {
        element,
        nodeId: outline.selectedId,
        centreX,
        centreY,
        startAngle: Math.atan2(event.clientY - centreY, event.clientX - centreX),
        startRotation,
        degrees: startRotation,
      };
      return;
    }
    const nodeId = nodeIdAt(event.target);
    const free = freeElement(nodeId);
    if (!free && nodeId) {
      // Anywhere else, pressing and dragging moves it to a new place in the page.
      const element = nodeElement(nodeId);
      if (element && element !== root && !element.closest("[contenteditable]")) {
        moving = { element, nodeId, startX: event.clientX, startY: event.clientY, moved: false };
      }
      return;
    }
    if (!free || !nodeId) return;
    dragging = {
      element: free.element,
      nodeId,
      container: free.container,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: free.element.offsetLeft,
      startTop: free.element.offsetTop,
      moved: false,
      left: free.element.offsetLeft,
      top: free.element.offsetTop,
    };
  });

  document.addEventListener("pointermove", (event) => {
    if (rotating) {
      const angle = Math.atan2(event.clientY - rotating.centreY, event.clientX - rotating.centreX);
      let degrees = rotating.startRotation + ((angle - rotating.startAngle) * 180) / Math.PI;
      degrees = ((((degrees + 180) % 360) + 360) % 360) - 180;
      degrees = event.shiftKey ? Math.round(degrees / 15) * 15 : Math.round(degrees);
      rotating.degrees = degrees;
      rotating.element.style.rotate = `${degrees}deg`;
      return;
    }
    if (moving) {
      if (!moving.moved) {
        if (Math.hypot(event.clientX - moving.startX, event.clientY - moving.startY) < 4) return;
        moving.moved = true;
        moving.element.style.opacity = "0.4";
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
        window.getSelection()?.removeAllRanges();
      }
      reportInsertOver(
        document.elementFromPoint(event.clientX, event.clientY),
        event.clientX,
        event.clientY,
      );
      return;
    }
    if (!dragging) return;
    const dx = event.clientX - dragging.startX;
    const dy = event.clientY - dragging.startY;
    if (!dragging.moved && Math.hypot(dx, dy) < 3) return;
    if (!dragging.moved) {
      dragging.moved = true;
      overlay.replaceChildren();
      document.body.style.userSelect = "none";
      window.getSelection()?.removeAllRanges();
    }
    const { element, container } = dragging;
    const others = Array.from(container.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== element)
      .filter((child) => child.hasAttribute("data-lintel-node"))
      .map((child) => ({
        left: child.offsetLeft,
        top: child.offsetTop,
        width: child.offsetWidth,
        height: child.offsetHeight,
      }));
    const box = {
      left: dragging.startLeft + dx,
      top: dragging.startTop + dy,
      width: element.offsetWidth,
      height: element.offsetHeight,
    };
    const frame = { width: container.clientWidth, height: container.clientHeight };
    const snapped = event.altKey
      ? { left: box.left, top: box.top, guides: [] }
      : snap(box, others, frame, 6);
    dragging.left = snapped.left;
    dragging.top = snapped.top;
    element.style.left = `${snapped.left}px`;
    element.style.top = `${snapped.top}px`;
    drawGuides(container, snapped.guides);
  });

  function endMove(cancelled: boolean) {
    if (!moving) return;
    const finished = moving;
    moving = null;
    lastInsertOver = "";
    if (!finished.moved) return;
    finished.element.style.opacity = "";
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    justMoved = !cancelled;
    send(cancelled ? { type: "moveCancel" } : { type: "moveDrop", nodeId: finished.nodeId });
  }

  document.addEventListener("pointerup", () => {
    if (moving) {
      endMove(false);
      return;
    }
    if (rotating) {
      send({ type: "rotate", nodeId: rotating.nodeId, degrees: rotating.degrees });
      rotating = null;
      return;
    }
    if (!dragging) return;
    const finished = dragging;
    dragging = null;
    document.body.style.userSelect = "";
    clearGuides();
    if (finished.moved) {
      sendPlace(finished.nodeId, finished.container, finished.left, finished.top);
    }
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
    if (moving?.moved && event.key === "Escape") {
      event.preventDefault();
      endMove(true);
      return;
    }
    if (editing) {
      const markKey = (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
      if (markKey && ["b", "i", "k"].includes(event.key.toLowerCase())) {
        // The browser's own bold isn't kept, so end editing (keeping the words) and let the
        // builder style the selected words: Mod+B, Mod+I and Mod+K.
        event.preventDefault();
        finishEditing(true);
        const { key, metaKey, ctrlKey, shiftKey, altKey } = event;
        send({ type: "key", key: { key, metaKey, ctrlKey, shiftKey, altKey } });
        return;
      }
      if (event.key === "Escape") {
        // Escape ends editing and keeps the words, as clicking away does; Undo takes them back.
        event.preventDefault();
        finishEditing(true);
      } else if (event.key === "Enter" && !event.shiftKey && editing.tagName !== "P") {
        event.preventDefault();
        finishEditing(true);
      }
      return;
    }
    const { key, metaKey, ctrlKey, shiftKey, altKey } = event;
    if (key === "Tab") return;
    const nudges: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const nudge = nudges[key];
    const free = nudge && !metaKey && !ctrlKey && !altKey ? freeElement(outline.selectedId) : null;
    if (nudge && free && outline.selectedId && outline.canTransform) {
      event.preventDefault();
      const distance = shiftKey ? 10 : 1;
      const left = free.element.offsetLeft + nudge[0] * distance;
      const top = free.element.offsetTop + nudge[1] * distance;
      free.element.style.left = `${left}px`;
      free.element.style.top = `${top}px`;
      drawOutlines();
      sendPlace(outline.selectedId, free.container, left, top);
      return;
    }
    event.preventDefault();
    send({ type: "key", key: { key, metaKey, ctrlKey, shiftKey, altKey } });
  });

  document.addEventListener("paste", (event) => {
    if (editing) return;
    event.preventDefault();
    const files = Array.from(event.clipboardData?.files ?? []).slice(0, 10);
    if (files.length > 0) {
      send({ type: "pasteFiles", files });
      return;
    }
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
.lintel-drop { position: absolute; box-sizing: border-box; pointer-events: none; }
.lintel-drop--line { background: #0071e3; border-radius: 2px; box-shadow: 0 0 0 1px #fff; }
.lintel-drop--inside { outline: 2px dashed #0071e3; outline-offset: -2px; background: rgb(0 113 227 / 0.06); }
.lintel-outline--selected { outline: 2px solid #0071e3; outline-offset: -1px; }
.lintel-outline--hover { outline: 1px solid #0071e3; outline-offset: -1px; opacity: 0.8; }
.lintel-outline__label { position: absolute; left: -1px; bottom: 100%; padding: 1px 6px; font: 600 11px/16px -apple-system, system-ui, sans-serif; color: #fff; background: #0071e3; border-radius: 4px 4px 0 0; white-space: nowrap; }
.lintel-outline--hover .lintel-outline__label { opacity: 0.9; }
[data-lintel-placeholder="image"] { min-height: 12rem; background: repeating-linear-gradient(135deg, #ececf1 0 12px, #f5f5f7 12px 24px); border-radius: 12px; }
[data-lintel-placeholder="unknown"] { min-height: 3rem; background: #fff4e5; }
[data-lintel-node]:empty:not(img, hr, br, [data-lintel-placeholder]) { min-height: 4rem; outline: 1px dashed #c7c7cc; outline-offset: -1px; }
[contenteditable] { outline: 2px solid #0071e3; outline-offset: 2px; cursor: text; }
.lintel-rotate-handle { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border: 2px solid #0071e3; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgb(0 0 0 / 0.3); pointer-events: auto; cursor: grab; }
.lintel-rotate-handle::after { content: ""; position: absolute; left: 50%; top: 100%; width: 1px; height: 12px; background: #0071e3; }
.lintel-guide { position: absolute; background: #ff2d87; pointer-events: none; }
.lintel-guide--x { width: 1px; }
.lintel-guide--y { height: 1px; }
[data-lintel-free] > [data-lintel-node] { cursor: move; touch-action: none; }
a { cursor: default; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
`;

/**
 * The site around the page, so the canvas shows it exactly as the website will: the same
 * stylesheet and body class, the real header and footer (which can't be selected), and the
 * motion runtime for previewing animations. The admin gets this from the API.
 */
export interface CanvasSite {
  /** The site's whole stylesheet, as the website serves it. */
  stylesheet: string;
  /** The website's `<body>` class, which carries its template. */
  bodyClassName: string;
  headerHtml: string;
  footerHtml: string;
  /** The website's address, so pictures with site paths (/_lintel/...) load. */
  baseUrl: string | null;
  /** The motion runtime (`@lintel/motion/site-runtime.js`), for previews. Empty for none. */
  motionScript: string;
  /**
   * The site's name, logo, social links and footer words, so Header and Footer elements on
   * the canvas show the site's own rather than a sample's.
   */
  siteName?: string;
  logo?: { src: string; alt: string; width: number | null; height: number | null } | null;
  socialLinks?: readonly string[];
  footerText?: string;
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
// A script's text ends at the first "</script", so any inside it are written another way.
const safeScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");

/**
 * The frame's script as a file of its own. A host with a Content-Security-Policy that
 * refuses inline scripts (the admin's does) serves this text at an address of its own and
 * passes that address as `scripts.frame`, since a frame drawn from `srcdoc` inherits the
 * policy of the page around it.
 */
export function canvasFrameScript(): string {
  return `(${runCanvasFrame.toString()})(${snapBox.toString()});\n`;
}

/**
 * Where a host serves the frame's scripts, for a Content-Security-Policy that refuses
 * inline ones: the frame script (`canvasFrameScript`) and the motion runtime
 * (`@lintel/motion/site-runtime.js`). Left out, both are written into the document.
 */
export interface CanvasScriptAddresses {
  frame: string;
  motion?: string;
}

/** The frame's whole document; the page itself arrives by message, inside `.lintel-design`. */
export function canvasFrameSource(site?: CanvasSite, scripts?: CanvasScriptAddresses): string {
  const base = site?.baseUrl ? `<base href="${escapeAttribute(site.baseUrl)}">` : "";
  const bodyClass = site ? ` class="${escapeAttribute(site.bodyClassName)}"` : "";
  // Marked, so a page with its own header or footer can hide the site's (see PageBuilder).
  const header = site?.headerHtml
    ? `<div inert data-lintel-site-chrome="header">${site.headerHtml}</div>`
    : "";
  const footer = site?.footerHtml
    ? `<div inert data-lintel-site-chrome="footer">${site.footerHtml}</div>`
    : "";
  const motion = !site?.motionScript
    ? ""
    : scripts?.motion
      ? `<script src="${escapeAttribute(scripts.motion)}"></script>`
      : `<script>${safeScript(site.motionScript)}</script>`;
  const frame = scripts
    ? `<script src="${escapeAttribute(scripts.frame)}"></script>`
    : `<script>${canvasFrameScript()}</script>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${base}<style id="lintel-page-style"></style><style>${canvasStyles}</style></head><body${bodyClass}>${header}<main class="lintel-main"><div id="lintel-page" class="lintel-design"></div></main>${footer}<div id="lintel-overlay"></div>${motion}${frame}</body></html>`;
}
