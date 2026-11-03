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
 * Dragging onto a placed grid in the canvas frame, in a real Chromium. The grid is ten
 * 100px columns with no gaps, and rows of at least 48px (3rem), so the lines are easy to
 * work out. The frame's messages are collected as in canvas-free-layout.test.ts.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

function story(): { design: PageDocument; photoId: string } {
  const empty = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Story",
      placedGrid: { columns: 10, stackOnPhone: true },
      styles: {
        base: {
          gap: "0px",
          paddingTop: "0",
          paddingBottom: "0",
          paddingLeft: "0",
          paddingRight: "0",
        },
      },
      children: [
        {
          type: "box",
          name: "Photo",
          styles: {
            base: { gridColumn: "2 / span 3", gridRow: "1 / span 2", backgroundColor: "red" },
          },
        },
      ],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return {
    design: { ...empty, root: { ...empty.root, children: [section] } },
    photoId: section.children[0]?.id ?? "",
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
      window.postMessage({ type: "render", html, css }, "*");
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

describe("placed grids on the canvas", () => {
  it("draws the grid and its places as the website will", async () => {
    const { design, photoId } = story();
    const page = await openCanvas(design, photoId);
    const box = await page.locator(`[data-lintel-node="${photoId}"]`).boundingBox();
    expect(box).toMatchObject({ x: 100, y: 0, width: 300, height: 96 });
    await page.close();
  });

  it("drags an element onto other columns and rows, showing the columns while it moves", async () => {
    const { design, photoId } = story();
    const page = await openCanvas(design, photoId);
    await page.mouse.move(250, 40);
    await page.mouse.down();
    await page.mouse.move(400, 60, { steps: 4 });
    await page.mouse.move(552, 92, { steps: 4 });
    expect(await page.locator(".lintel-grid-column").count()).toBe(10);
    expect(await page.locator(".lintel-grid-area").textContent()).toBe("5–7");
    await page.mouse.up();
    expect(await lastMessage(page, "gridPlace")).toEqual({
      type: "gridPlace",
      nodeId: photoId,
      column: 5,
      columnSpan: 3,
      row: 2,
      rowSpan: 2,
    });
    expect(await page.locator(".lintel-grid-column").count()).toBe(0);
    await page.close();
  });

  it("makes the selected element wider and taller with its corner handle", async () => {
    const { design, photoId } = story();
    const page = await openCanvas(design, photoId);
    const handle = await page.locator(".lintel-grid-handle").boundingBox();
    expect(handle).not.toBeNull();
    await page.mouse.move((handle?.x ?? 0) + 6, (handle?.y ?? 0) + 6);
    await page.mouse.down();
    await page.mouse.move(600, 200, { steps: 6 });
    await page.mouse.up();
    expect(await lastMessage(page, "gridPlace")).toMatchObject({
      column: 2,
      columnSpan: 5,
      row: 1,
      rowSpan: 4,
    });
    await page.close();
  });

  it("moves a column at a time with the arrow keys, and grows with Shift", async () => {
    const { design, photoId } = story();
    const page = await openCanvas(design, photoId);
    await page.locator("body").focus();
    await page.keyboard.press("ArrowRight");
    expect(await lastMessage(page, "gridPlace")).toMatchObject({
      column: 3,
      columnSpan: 3,
      row: 1,
    });
    await page.keyboard.press("Shift+ArrowDown");
    expect(await lastMessage(page, "gridPlace")).toMatchObject({ column: 2, rowSpan: 3 });
    await page.close();
  });
});
