import { eachBehaviour, prefersReducedMotion } from "./behaviour-helpers.js";

/** Numbers that count up, countdowns, menus, "back to top" and the sort and language menus. */

export function setUpCounters(root: ParentNode): void {
  eachBehaviour(root, "counter", (counter) => {
    const number = counter.querySelector<HTMLElement>(".lintel-counter__number");
    const target = Number(counter.dataset.value);
    const decimals = Number(counter.dataset.decimals ?? 0);
    if (!number || !Number.isFinite(target) || prefersReducedMotion()) return;
    const format = new Intl.NumberFormat(document.documentElement.lang || undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    // Keep the final number's width, so nothing moves while it counts.
    number.style.display = "inline-block";
    number.style.minWidth = `${number.getBoundingClientRect().width}px`;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const started = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / 1400);
        const eased = 1 - (1 - progress) ** 3;
        number.textContent = format.format(target * eased);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    observer.observe(counter);
  });
}

export function setUpCountdowns(root: ParentNode): void {
  eachBehaviour(root, "countdown", (countdown) => {
    const until = countdown.dataset.until ? new Date(countdown.dataset.until).getTime() : NaN;
    if (!Number.isFinite(until)) return;
    const units = { days: 86400, hours: 3600, minutes: 60, seconds: 1 } as const;
    const tick = () => {
      let left = Math.max(0, Math.floor((until - Date.now()) / 1000));
      for (const [unit, size] of Object.entries(units)) {
        const element = countdown.querySelector<HTMLElement>(
          `[data-unit="${unit}"] .lintel-countdown__number`,
        );
        if (!element) continue;
        const value = Math.floor(left / size);
        left -= value * size;
        element.textContent = String(value).padStart(2, "0");
      }
      if (until <= Date.now()) {
        const label = countdown.querySelector(".lintel-countdown__label");
        if (label) label.textContent = countdown.dataset.finished ?? "";
        return;
      }
      window.setTimeout(tick, 1000);
    };
    tick();
  });
}

/** Big menus: one open at a time, Escape closes and returns focus, clicking away closes. */
/**
 * Keeps what the browser scrolls to clear of a sticky header: its height (it grows when the
 * menu wraps on a phone) plus a little room, as `--lintel-header-clearance`, which the
 * site's and the designer's header styles use for `scroll-padding-top` (LINTEL-A11Y-006).
 */
export function setUpHeaderClearance(document: Document): void {
  const header = document.querySelector<HTMLElement>(".lintel-header, .lintel-site-header--sticky");
  if (!header || typeof ResizeObserver === "undefined") return;
  const update = () =>
    document.documentElement.style.setProperty(
      "--lintel-header-clearance",
      `${Math.ceil(header.getBoundingClientRect().height) + 8}px`,
    );
  new ResizeObserver(update).observe(header);
  update();
}

export function setUpHeaders(root: ParentNode): void {
  eachBehaviour(root, "site-header", (header) => {
    const menus = [...header.querySelectorAll<HTMLDetailsElement>(".lintel-mega__disclosure")];
    for (const menu of menus) {
      menu.addEventListener("toggle", () => {
        if (menu.open) for (const other of menus) if (other !== menu) other.open = false;
      });
      menu.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !menu.open) return;
        menu.open = false;
        menu.querySelector("summary")?.focus();
      });
    }
    document.addEventListener("click", (event) => {
      for (const menu of menus)
        if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
    });
  });
}

export function setUpBackToTop(root: ParentNode): void {
  eachBehaviour(root, "back-to-top", (link) => {
    const floats = link.classList.contains("lintel-back-to-top--floats");
    const update = () => {
      if (floats) link.toggleAttribute("data-hidden", window.scrollY < window.innerHeight);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      const target = document.querySelector<HTMLElement>("h1, main") ?? document.body;
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });
}

export function setUpMenus(root: ParentNode): void {
  eachBehaviour(root, "language-menu", (form) => {
    form.querySelector("select")?.addEventListener("change", (event) => {
      const address = (event.target as HTMLSelectElement).value;
      if (address) window.location.assign(address);
    });
  });
  eachBehaviour(root, "sort-menu", (form) => {
    form.querySelector("select")?.addEventListener("change", (event) => {
      const select = event.target as HTMLSelectElement;
      const address = select.selectedOptions[0]?.dataset.url;
      if (address) window.location.assign(address);
      else (form as HTMLFormElement).requestSubmit();
    });
  });
}
