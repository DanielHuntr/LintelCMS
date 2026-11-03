import { eachBehaviour } from "./behaviour-helpers.js";

/** Tabs (arrow keys, Home and End), accordions that open one at a time, and pop-ups. */

/**
 * Elements with an open state (a card that shows more, a panel): their first button (or the
 * element itself, if it's a button) toggles `data-open` on them, which their open styles
 * follow, and says so with `aria-expanded`. Escape closes it again and puts focus back on the
 * button. A link inside is left to do its own thing.
 */
export function setUpOpenStates(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-lintel-opens]").forEach((element) => {
    if (element.dataset.lintelOpensReady) return;
    element.dataset.lintelOpensReady = "true";
    const toggle = element.matches("button, summary")
      ? element
      : (element.querySelector<HTMLElement>("button, summary, [role='button']") ?? element);
    if (toggle === element && !element.matches("button, summary")) {
      element.tabIndex = 0;
      element.setAttribute("role", "button");
    }
    toggle.setAttribute("aria-expanded", "false");
    const setOpen = (open: boolean) => {
      element.toggleAttribute("data-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };
    toggle.addEventListener("click", (event) => {
      if ((event.target as Element).closest("a") && toggle !== element) return;
      if (toggle.matches("summary")) event.preventDefault();
      setOpen(!element.hasAttribute("data-open"));
    });
    if (toggle === element) {
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        setOpen(!element.hasAttribute("data-open"));
      });
    }
    element.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !element.hasAttribute("data-open")) return;
      setOpen(false);
      toggle.focus();
    });
  });
}

export function setUpTabs(root: ParentNode): void {
  eachBehaviour(root, "tabs", (tabs) => {
    const buttons = [
      ...tabs.querySelectorAll<HTMLButtonElement>(":scope > .lintel-tabs__list > [role=tab]"),
    ];
    const select = (chosen: HTMLButtonElement, focus: boolean) => {
      for (const button of buttons) {
        const isChosen = button === chosen;
        button.setAttribute("aria-selected", String(isChosen));
        button.tabIndex = isChosen ? 0 : -1;
        const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
        if (panel) panel.hidden = !isChosen;
      }
      if (focus) chosen.focus();
    };
    buttons.forEach((button, index) => {
      button.addEventListener("click", () => select(button, false));
      button.addEventListener("keydown", (event) => {
        const next =
          event.key === "ArrowRight"
            ? buttons[(index + 1) % buttons.length]
            : event.key === "ArrowLeft"
              ? buttons[(index - 1 + buttons.length) % buttons.length]
              : event.key === "Home"
                ? buttons[0]
                : event.key === "End"
                  ? buttons[buttons.length - 1]
                  : undefined;
        if (!next) return;
        event.preventDefault();
        select(next, true);
      });
    });
  });
}

export function setUpAccordions(root: ParentNode): void {
  eachBehaviour(root, "accordion", (accordion) => {
    if (!accordion.hasAttribute("data-one-open")) return;
    const items = [...accordion.querySelectorAll<HTMLDetailsElement>(":scope > details")];
    for (const item of items) {
      item.addEventListener("toggle", () => {
        if (!item.open) return;
        for (const other of items) if (other !== item) other.open = false;
      });
    }
  });
}

/**
 * Buttons with `command="show-modal"` open their dialog in browsers that don't do it
 * themselves yet. Clicking the dark area around a pop-up closes it, as people expect.
 */
export function setUpDialogs(root: ParentNode): void {
  const nativeCommands = "command" in HTMLButtonElement.prototype;
  root.querySelectorAll<HTMLButtonElement>("button[commandfor]").forEach((button) => {
    if (button.dataset.dialogReady) return;
    button.dataset.dialogReady = "yes";
    const dialog = document.getElementById(button.getAttribute("commandfor") ?? "");
    if (!(dialog instanceof HTMLDialogElement)) return;
    if (!nativeCommands) button.addEventListener("click", () => dialog.showModal());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}
