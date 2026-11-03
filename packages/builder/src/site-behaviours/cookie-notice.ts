import type { CookieNoticePage } from "@lintel/builder-model";
import { readChoice, readNoticePage, saveChoice } from "./consent-choice.js";
import { cookieNoticeCss } from "./cookie-notice-styles.js";

/**
 * The site's cookie notice: shown to visitors who haven't chosen yet (or whose choice is six
 * months old, or was made before the site's services changed), and again from any "Cookie
 * settings" link. "Accept all" and "Only necessary" look the same, so neither is the easy
 * way out; "Choose" lists each service with a switch.
 *
 * It is a region with a heading near the start of the page, so keyboards and screen readers
 * reach it early, but it never takes focus when it appears and never covers the page in a
 * way that stops reading. A choice is kept by consent-choice.ts, which tells the elements
 * script to load the allowed embeds where they are.
 */

const adobeFontsId = "adobe-fonts";

interface OpenOptions {
  /** Open with each service's switch showing, as "Cookie settings" does. */
  choosing: boolean;
  /** What opened it, which gets focus back once a choice is made. */
  opener?: HTMLElement | null;
}

export interface CookieNotice {
  open(options: OpenOptions): void;
  close(): void;
  readonly element: HTMLElement | null;
}

let currentNotice: CookieNotice | null = null;
const listeningFor = new WeakSet<Document>();

/** Sets the notice up on a page that has its settings; does nothing on any other page. */
export function setUpCookieNotice(document: Document, now = Date.now()): CookieNotice | null {
  const page = readNoticePage(document);
  if (!page) return null;
  const choice = readChoice(page, now);
  if (choice) linkAllowedStylesheets(document, page, choice.allowed);
  const notice = createNotice(document, page);
  exposeConsent(page, notice);
  currentNotice = notice;
  if (!listeningFor.has(document)) {
    listeningFor.add(document);
    document.addEventListener("click", (event) => {
      const target = event.target as Element | null;
      const opener = target?.closest?.<HTMLElement>("[data-lintel-cookie-settings]");
      if (!opener || !currentNotice) return;
      event.preventDefault();
      currentNotice.open({ choosing: true, opener });
    });
  }
  if (!choice) notice.open({ choosing: false });
  return notice;
}

/** Adobe Fonts' stylesheets, linked only once the visitor has allowed Adobe Fonts. */
function linkAllowedStylesheets(
  document: Document,
  page: CookieNoticePage,
  allowed: readonly string[],
): void {
  if (!allowed.includes(adobeFontsId)) return;
  for (const href of page.fontStylesheets) {
    const linked = [
      ...document.querySelectorAll<HTMLLinkElement>("link[data-lintel-allowed-font]"),
    ];
    if (linked.some((link) => link.dataset.lintelAllowedFont === href)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.lintelAllowedFont = href;
    document.head.append(link);
  }
}

/** What plugins' scripts can ask: whether a service is allowed, and to open the notice. */
function exposeConsent(page: CookieNoticePage, notice: CookieNotice): void {
  const target = window as unknown as Record<string, unknown>;
  target.lintelConsent = {
    allows: (serviceId: string) => readChoice(page)?.allowed.includes(serviceId) ?? false,
    open: () => notice.open({ choosing: true }),
  };
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: Tag,
  className: string,
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const made = document.createElement(tag);
  made.className = className;
  if (text !== undefined) made.textContent = text;
  return made;
}

function createNotice(document: Document, page: CookieNoticePage): CookieNotice {
  let region: HTMLElement | null = null;
  let spacer: HTMLElement | null = null;
  let resizeWatcher: ResizeObserver | null = null;
  let returnFocusTo: HTMLElement | null = null;

  const close = () => {
    resizeWatcher?.disconnect();
    resizeWatcher = null;
    region?.remove();
    spacer?.remove();
    region = null;
    spacer = null;
    document.documentElement.style.removeProperty("--lintel-cookie-notice-space");
  };

  const decide = (allowed: readonly string[]) => {
    const before = readChoice(page)?.allowed ?? [];
    const focusWasInside = region?.contains(document.activeElement) ?? false;
    saveChoice(page, allowed);
    linkAllowedStylesheets(document, page, allowed);
    close();
    // Something already loaded that is no longer allowed goes when the page is read again.
    const withdrawn = before.filter((id) => !allowed.includes(id));
    if (withdrawn.some((id) => isLoaded(document, id))) {
      window.location.reload();
      return;
    }
    if (focusWasInside) {
      const next = returnFocusTo?.isConnected
        ? returnFocusTo
        : document.getElementById("main-content");
      next?.focus({ preventScroll: true });
    }
    returnFocusTo = null;
  };

  const open = ({ choosing, opener }: OpenOptions) => {
    close();
    returnFocusTo = opener ?? null;
    ensureStyles(document);
    const allowedNow = new Set(readChoice(page)?.allowed ?? []);
    const built = buildRegion(document, page, allowedNow, decide);
    region = built.region;
    const skipLink = document.querySelector("body > .lintel-skip-link");
    if (skipLink) skipLink.after(region);
    else document.body.prepend(region);
    if (page.position === "bar") {
      spacer = element(document, "div", "lintel-cookie-notice-space");
      spacer.setAttribute("aria-hidden", "true");
      document.body.append(spacer);
      resizeWatcher = watchHeight(document, built.panel);
    }
    if (choosing) {
      built.showChoices();
      // Asked for by the visitor, so focus goes to the notice they opened.
      built.heading.focus();
    }
  };

  return {
    open,
    close,
    get element() {
      return region;
    },
  };
}

/** Whether a service already put something on this page: a loaded embed or a font stylesheet. */
function isLoaded(document: Document, serviceId: string): boolean {
  if (serviceId === adobeFontsId) {
    return document.querySelector("link[data-lintel-allowed-font]") !== null;
  }
  return [...document.querySelectorAll<HTMLElement>("[data-consent-service][data-loaded]")].some(
    (frame) => frame.dataset.consentService === serviceId,
  );
}

function ensureStyles(document: Document): void {
  if (document.getElementById("lintel-cookie-notice-styles")) return;
  const style = document.createElement("style");
  style.id = "lintel-cookie-notice-styles";
  style.textContent = cookieNoticeCss;
  document.head.append(style);
}

/** Keeps room at the end of the page as tall as the bar, so the end can still be read. */
function watchHeight(document: Document, panel: HTMLElement): ResizeObserver | null {
  const set = () =>
    document.documentElement.style.setProperty(
      "--lintel-cookie-notice-space",
      `${Math.ceil(panel.getBoundingClientRect().height) + 16}px`,
    );
  set();
  if (typeof ResizeObserver === "undefined") return null;
  const watcher = new ResizeObserver(set);
  watcher.observe(panel);
  return watcher;
}

function buildRegion(
  document: Document,
  page: CookieNoticePage,
  allowedNow: ReadonlySet<string>,
  decide: (allowed: readonly string[]) => void,
) {
  const { labels } = page;
  const region = element(
    document,
    "section",
    `lintel-cookie-notice lintel-cookie-notice--${page.position}`,
  );
  region.id = "lintel-cookie-notice-region";
  region.setAttribute("aria-labelledby", "lintel-cookie-notice-heading");
  const panel = element(document, "div", "lintel-cookie-notice__panel");

  const words = element(document, "div", "lintel-cookie-notice__words");
  const heading = element(document, "h2", "lintel-cookie-notice__heading", page.heading);
  heading.id = "lintel-cookie-notice-heading";
  heading.tabIndex = -1;
  const message = element(document, "p", "lintel-cookie-notice__message", page.message);
  if (page.privacyUrl) {
    const link = element(document, "a", "", labels.privacy);
    link.href = page.privacyUrl;
    message.append(" ", link);
  }
  words.append(heading, message);

  const choices = element(document, "fieldset", "lintel-cookie-notice__choices");
  choices.hidden = true;
  choices.append(element(document, "legend", "lintel-cookie-notice__legend", labels.servicesList));
  const switches = page.services.map((service) => {
    const row = element(document, "label", "lintel-cookie-notice__choice");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("role", "switch");
    input.value = service.id;
    input.checked = allowedNow.has(service.id);
    row.append(element(document, "span", "", service.name), input);
    choices.append(row);
    return input;
  });

  const actions = element(document, "div", "lintel-cookie-notice__actions");
  const button = (label: string, quiet = false) => {
    const made = element(
      document,
      "button",
      `lintel-cookie-notice__button${quiet ? " lintel-cookie-notice__button--quiet" : ""}`,
      label,
    );
    made.type = "button";
    return made;
  };
  const acceptAll = button(labels.acceptAll);
  const onlyNecessary = button(labels.onlyNecessary);
  const choose = button(labels.choose, true);
  choose.setAttribute("aria-expanded", "false");
  choose.setAttribute("aria-controls", "lintel-cookie-notice-choices");
  choices.id = "lintel-cookie-notice-choices";
  actions.append(acceptAll, onlyNecessary, choose);

  const showChoices = () => {
    choices.hidden = false;
    choose.textContent = labels.save;
    choose.setAttribute("aria-expanded", "true");
  };
  acceptAll.addEventListener("click", () => decide(page.services.map((service) => service.id)));
  onlyNecessary.addEventListener("click", () => decide([]));
  choose.addEventListener("click", () => {
    if (choices.hidden) {
      showChoices();
      switches[0]?.focus();
      return;
    }
    decide(switches.filter((input) => input.checked).map((input) => input.value));
  });

  panel.append(words, choices, actions);
  region.append(panel);
  return { region, panel, heading, showChoices };
}
