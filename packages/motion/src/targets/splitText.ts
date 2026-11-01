/**
 * Splits an element's text into words or letters, each in its own span, so they can be
 * animated one by one. Inline markup (links, bold) is kept, because only text nodes are split.
 *
 * Screen readers would read split letters one at a time, so the pieces are hidden from them
 * and the original text is kept in a visually hidden copy.
 */

export interface SplitText {
  pieces: HTMLElement[];
  /** Puts the original text back. */
  restore(): void;
}

const visuallyHidden =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0";

function textNodesIn(root: Element): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && node.data.trim() !== "") nodes.push(node);
  }
  return nodes;
}

function piece(document: Document, text: string, className: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = className;
  // Transforms don't apply to inline boxes, so each piece is an inline block.
  span.style.display = "inline-block";
  span.textContent = text;
  return span;
}

function splitNode(node: Text, mode: "words" | "letters", pieces: HTMLElement[]): DocumentFragment {
  const document = node.ownerDocument;
  const fragment = document.createDocumentFragment();
  for (const part of node.data.split(/(\s+)/)) {
    if (part === "") continue;
    if (/^\s+$/.test(part)) {
      fragment.append(document.createTextNode(part));
      continue;
    }
    if (mode === "words") {
      const word = piece(document, part, "motion-word");
      pieces.push(word);
      fragment.append(word);
      continue;
    }
    // Letters sit inside an unbreakable word, so lines still break between words.
    const word = document.createElement("span");
    word.className = "motion-word";
    word.style.display = "inline-block";
    word.style.whiteSpace = "nowrap";
    for (const letter of Array.from(part)) {
      const letterSpan = piece(document, letter, "motion-letter");
      pieces.push(letterSpan);
      word.append(letterSpan);
    }
    fragment.append(word);
  }
  return fragment;
}

export function splitText(root: HTMLElement, mode: "words" | "letters"): SplitText {
  const document = root.ownerDocument;
  const originalNodes = Array.from(root.childNodes);
  const label = root.textContent ?? "";
  const pieces: HTMLElement[] = [];

  const visible = document.createElement("span");
  visible.setAttribute("aria-hidden", "true");
  visible.append(...originalNodes.map((node) => node.cloneNode(true)));
  for (const node of textNodesIn(visible)) node.replaceWith(splitNode(node, mode, pieces));

  const spoken = document.createElement("span");
  spoken.setAttribute("style", visuallyHidden);
  spoken.textContent = label;

  root.replaceChildren(spoken, visible);
  return {
    pieces,
    restore: () => root.replaceChildren(...originalNodes),
  };
}
