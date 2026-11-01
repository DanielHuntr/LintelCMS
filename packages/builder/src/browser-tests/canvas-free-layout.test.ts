import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canvasFrameSource } from "../canvas/canvas-frame-script.js";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * The canvas frame's script in a real Chromium: the page is drawn by message as in the
 * builder, and the messages the frame sends back to the builder are collected. In a page of
 * its own the frame's "parent" is itself, so it hears its own messages.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

function stage(): { design: PageDocument; wordId: string; photoId: string } {
  const empty = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Stage",
      freeLayout: { stackOnPhone: true },
      styles: {
        base: {
          height: "600px",
          paddingTop: "0",
          paddingBottom: "0",
          paddingLeft: "0",
          paddingRight: "0",
        },
      },
      children: [
        {
          type: "heading",
          name: "Word",
          props: { text: "Word", level: 2 },
          styles: {
            base: { left: "10%", top: "10%", width: "200px", height: "100px", marginTop: "0" },
          },
        },
        {
          type: "box",
          name: "Photo",
          styles: {
            base: {
              left: "50%",
              top: "50%",
              width: "100px",
              height: "100px",
              backgroundColor: "red",
            },
          },
        },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  const [word, photo] = section.children;
  return {
    design: { ...empty, root: { ...empty.root, children: [section] } },
    wordId: word?.id ?? "",
    photoId: photo?.id ?? "",
  };
}

async function openCanvas(design: PageDocument, selectedId: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent(canvasFrameSource());
  const { html, css } = renderPage(design, standardRegistry, { mode: "canvas" });
  await page.evaluate(
    ({ html, css, selectedId }) => {
      const received: unknown[] = [];
      Object.assign(window, { received });
      window.addEventListener("message", (event) => received.push(event.data));
      document.body.style.margin = "0";
      window.postMessage({ type: "render", html, css: `${css}` }, "*");
      window.postMessage(
        {
          type: "outline",
          selectedId,
          hoveredId: null,
          labels: { selected: "Photo", hovered: null },
          canTransform: true,
          rotateLabel: "Turn",
        },
        "*",
      );
    },
    { html, css: `body{margin:0} ${designBaseStylesheet}\n${css}`, selectedId },
  );
  await page.waitForTimeout(100);
  return page;
}

/** The latest message of a type the frame sent; messages arrive a moment after they are sent. */
async function lastMessage(page: Page, type: string): Promise<Record<string, unknown> | undefined> {
  await page.waitForTimeout(50);
  return page.evaluate(
    (wanted) =>
      ((window as unknown as { received: Array<Record<string, unknown>> }).received ?? [])
        .filter((message) => message.type === wanted)
        .at(-1),
    type,
  );
}

describe("the canvas in a real browser", () => {
  it("drags an element in a free layout and snaps it to the section’s edge", async () => {
    const { design, photoId } = stage();
    const page = await openCanvas(design, photoId);
    const photo = page.locator(`[data-lintel-node="${photoId}"]`);
    const box = await photo.boundingBox();
    expect(box).toMatchObject({ x: 500, y: 300, width: 100, height: 100 });
    await page.mouse.move(550, 350);
    await page.mouse.down();
    await page.mouse.move(400, 350, { steps: 4 });
    // 3px from the left edge of the section: it snaps to 0 and a guide shows.
    await page.mouse.move(53, 210, { steps: 4 });
    expect(await page.locator(".lintel-guide--x").count()).toBeGreaterThan(0);
    await page.mouse.up();
    const place = await lastMessage(page, "place");
    expect(place).toMatchObject({ nodeId: photoId, left: 0 });
    expect(Number(place?.top)).toBeCloseTo((160 / 600) * 100, 1);
    await page.close();
  });

  it("lines an element up with another’s edge, and doesn’t snap with Alt held", async () => {
    const { design, photoId } = stage();
    const page = await openCanvas(design, photoId);
    // The word ends at 300px across; drop the photo's left edge 4px from it.
    await page.mouse.move(550, 350);
    await page.mouse.down();
    await page.mouse.move(354, 450, { steps: 5 });
    await page.mouse.up();
    expect(await lastMessage(page, "place")).toMatchObject({ left: 30 });

    await page.mouse.move(350, 450);
    await page.keyboard.down("Alt");
    await page.mouse.down();
    await page.mouse.move(354, 450, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up("Alt");
    expect(await lastMessage(page, "place")).toMatchObject({ left: 30.4 });
    await page.close();
  });

  it("nudges the selected element with the arrow keys", async () => {
    const { design, photoId } = stage();
    const page = await openCanvas(design, photoId);
    await page.locator("body").focus();
    await page.keyboard.press("Shift+ArrowRight");
    expect(await lastMessage(page, "place")).toMatchObject({ nodeId: photoId, left: 51, top: 50 });
    await page.close();
  });

  it("turns the selected element with its handle, in 15° steps with Shift", async () => {
    const { design, photoId } = stage();
    const page = await openCanvas(design, photoId);
    const handle = page.locator(".lintel-rotate-handle");
    const start = await handle.boundingBox();
    expect(start).not.toBeNull();
    // The element's centre is (550, 350); dragging from above it round to its right is 90°.
    await page.mouse.move((start?.x ?? 0) + 8, (start?.y ?? 0) + 8);
    await page.mouse.down();
    await page.keyboard.down("Shift");
    await page.mouse.move(700, 340, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    expect(await lastMessage(page, "rotate")).toEqual({
      type: "rotate",
      nodeId: photoId,
      degrees: 90,
    });
    await page.close();
  });

  it("reports the selected part of a text in characters of the stored text", async () => {
    const { design, wordId } = stage();
    const page = await openCanvas(design, wordId);
    await page.evaluate((nodeId) => {
      const heading = document.querySelector(`[data-lintel-node="${nodeId}"]`);
      const text = heading?.firstChild;
      if (!text) return;
      const range = document.createRange();
      range.setStart(text, 1);
      range.setEnd(text, 3);
      window.getSelection()?.addRange(range);
    }, wordId);
    await page.waitForTimeout(50);
    expect(await lastMessage(page, "textSelection")).toEqual({
      type: "textSelection",
      nodeId: wordId,
      prop: "text",
      from: 1,
      to: 3,
      text: "Word",
    });
    await page.close();
  });
});
