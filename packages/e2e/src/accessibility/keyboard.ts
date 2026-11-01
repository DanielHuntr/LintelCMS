import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Moves focus with Tab, the way a keyboard user does, until `target` has it. Fails if it
 * can't be reached in `limit` presses, which usually means it isn't focusable at all.
 */
export async function tabTo(page: Page, target: Locator, limit = 60): Promise<void> {
  for (let presses = 0; presses < limit; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expectVisibleFocus(target);
      return;
    }
    await page.keyboard.press("Tab");
  }
  throw new Error(`Couldn't reach ${target} with ${limit} presses of Tab.`);
}

/**
 * Moves focus with an arrow key inside a group with one tab stop (a grid of tiles, a radio
 * group) until `target` has it.
 */
export async function arrowTo(
  page: Page,
  target: Locator,
  key: "ArrowRight" | "ArrowDown" = "ArrowRight",
  limit = 30,
): Promise<void> {
  for (let presses = 0; presses < limit; presses++) {
    if (await target.evaluate((element) => element === document.activeElement)) {
      await expectVisibleFocus(target);
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error(`Couldn't reach ${target} with ${limit} presses of ${key}.`);
}

/**
 * Whoever has focus must show it. Fields people type in show the text cursor, which is
 * enough on its own. Anything else needs an outline or a ring (box shadow) that appears
 * with focus, on itself or on a part inside it (a tile rings its picture, for example):
 * the focused element is compared with an unfocused copy of itself.
 */
export async function expectVisibleFocus(target: Locator): Promise<void> {
  const indicator = await target.evaluate((element) => {
    const isTextEntry =
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement &&
        ["text", "search", "email", "url", "password", "number", "tel"].includes(element.type)) ||
      (element instanceof HTMLElement && element.isContentEditable);
    if (isTextEntry) {
      return true;
    }

    const rings = (root: Element) =>
      [root, ...root.querySelectorAll("*")].map((part) => {
        const style = getComputedStyle(part);
        const outline =
          style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0
            ? `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`
            : "none";
        return `${outline} | ${style.boxShadow}`;
      });

    // Without transitions, so a ring that is still fading in counts as there.
    const noTransitions = document.createElement("style");
    noTransitions.textContent = "*, *::before, *::after { transition: none !important; }";
    document.head.append(noTransitions);
    const unfocusedCopy = element.cloneNode(true) as Element;
    unfocusedCopy.removeAttribute("id");
    element.after(unfocusedCopy);
    try {
      const focused = rings(element);
      const unfocused = rings(unfocusedCopy);
      return focused.some((ring, index) => ring !== unfocused[index]);
    } finally {
      unfocusedCopy.remove();
      noTransitions.remove();
    }
  });
  expect(indicator, `${target} has focus but shows no focus indicator`).toBe(true);
}
