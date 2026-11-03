import type { MenuItem } from "@lintel/site-components";
import { resizedImageUrl } from "@lintel/site-components";
import { renderResponsiveImageHtml } from "@lintel/site-components/server";
import {
  type Context,
  type Emitter,
  evalToken,
  Hash,
  type Liquid,
  Tag,
  type TagToken,
  type TopLevelToken,
  type ValueToken,
} from "liquidjs";
import { readHtml, readImage } from "../website/delivered-to-site.js";
import { findPageHelpers, type LiquidPageHelpers } from "./liquid-page-helpers.js";

/**
 * Lintel's own parts, for Liquid templates:
 *
 *   {% image entry.data.hero width: 800, ratio: "16/9" %}  a responsive, cropped picture
 *   {% menu "main" %}                                      a menu as a list of links
 *   {% form "contact" %}                                   a form from Forms
 *   {% design %}                                           the page's visual design
 *   {% lintel_head %} {% site_header %} {% site_footer %}  the shared document's parts
 *   {{ entry.data.body | rich_text }}                      rich text, already made safe
 *   {{ entry.data.hero | image_url: 800 }}                 the address of a resized copy
 *
 * Everything else a template prints is escaped (see liquid-engine.ts); these write HTML
 * Lintel made, with every value in it escaped.
 */
export function registerLintelTags(engine: Liquid): void {
  engine.registerTag("image", ImageTag);
  engine.registerTag("menu", MenuTag);
  engine.registerTag("form", FormTag);
  engine.registerTag(
    "design",
    PartTag("design", (helpers) => helpers.design()),
  );
  engine.registerTag(
    "lintel_head",
    PartTag("lintel_head", (helpers) => helpers.headMarker),
  );
  engine.registerTag(
    "site_header",
    PartTag("site_header", (helpers) => helpers.header),
  );
  engine.registerTag(
    "site_footer",
    PartTag("site_footer", (helpers) => helpers.footer),
  );
  // Rich text arrives as finished, cleaned HTML; anything else is printed as plain text.
  engine.registerFilter("rich_text", {
    raw: true,
    handler: (value: unknown) => {
      const html = readHtml(value);
      return html || (typeof value === "string" ? escapeHtml(value) : "");
    },
  });
  engine.registerFilter("image_url", (value: unknown, width: unknown, ratio: unknown) => {
    const image = readImage(value);
    if (!image) return "";
    return resizedImageUrl(image, readWidth(width) ?? 1440, readRatio(ratio));
  });
}

/** A tag with one value and then `name: value` options: `{% image entry.data.hero width: 800 %}`. */
abstract class ValueAndOptionsTag extends Tag {
  protected readonly valueToken: ValueToken;
  protected readonly options: Hash;

  constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
    super(token, remainTokens, liquid);
    const valueToken = this.tokenizer.readValue();
    if (!valueToken) {
      throw new Error(
        `{% ${token.name} %} needs something to show, like {% ${token.name} "main" %}`,
      );
    }
    this.valueToken = valueToken;
    this.options = new Hash(this.tokenizer);
  }

  *readArguments(ctx: Context): Generator<unknown, [unknown, Record<string, unknown>], unknown> {
    const value: unknown = yield evalToken(this.valueToken, ctx);
    const options = (yield this.options.render(ctx)) as Record<string, unknown>;
    return [value, options];
  }
}

class ImageTag extends ValueAndOptionsTag {
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const [value, options] = yield* this.readArguments(ctx);
    emitter.write(renderImage(value, options));
  }
}

/** The picture an image field holds, as the built-in components draw it; "" for none. */
export function renderImage(value: unknown, options: Record<string, unknown>): string {
  const image = readImage(value);
  if (!image) return "";
  const width = readWidth(options.width);
  const alt = typeof options.alt === "string" ? options.alt : image.alt;
  return renderResponsiveImageHtml({
    image: { ...image, alt },
    aspectRatio: readRatio(options.ratio),
    sizes:
      typeof options.sizes === "string"
        ? options.sizes
        : width
          ? `(max-width: ${width}px) 100vw, ${width}px`
          : "100vw",
    priority: options.priority === true,
    className: typeof options.class === "string" ? options.class : undefined,
  });
}

class MenuTag extends ValueAndOptionsTag {
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const [handle, options] = yield* this.readArguments(ctx);
    const helpers = findPageHelpers(ctx.globals);
    if (!helpers || typeof handle !== "string") return;
    const items = (yield helpers.menu(handle)) as MenuItem[];
    const label = typeof options.label === "string" ? options.label : handleInWords(handle);
    emitter.write(renderMenu(items, label));
  }
}

/** A menu as a `<nav>` with a list of links (and lists inside for submenus); "" when empty. */
export function renderMenu(items: readonly MenuItem[], label: string): string {
  if (items.length === 0) return "";
  return `<nav class="lintel-menu" aria-label="${escapeHtml(label)}">${renderMenuList(items)}</nav>`;
}

function renderMenuList(items: readonly MenuItem[]): string {
  const rendered = items.map((item) => {
    const text = escapeHtml(item.label);
    const link =
      item.url === null
        ? `<span class="lintel-menu__label">${text}</span>`
        : `<a class="lintel-menu__link" href="${escapeHtml(item.url)}"${
            item.current ? ' aria-current="page"' : ""
          }${item.newTab ? ' target="_blank" rel="noopener"' : ""}>${text}</a>`;
    const children = item.children.length > 0 ? renderMenuList(item.children) : "";
    return `<li class="lintel-menu__item">${link}${children}</li>`;
  });
  return `<ul class="lintel-menu__list">${rendered.join("")}</ul>`;
}

class FormTag extends ValueAndOptionsTag {
  *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
    const [handle, options] = yield* this.readArguments(ctx);
    const helpers = findPageHelpers(ctx.globals);
    if (!helpers || typeof handle !== "string") return;
    const html = (yield helpers.form(handle, { showTitle: options.show_title === true })) as string;
    emitter.write(html);
  }
}

/** A tag with no arguments that writes one of the page's parts. */
function PartTag(name: string, read: (helpers: LiquidPageHelpers) => string) {
  return class extends Tag {
    constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
      super(token, remainTokens, liquid);
      if (this.tokenizer.remaining().trim() !== "") {
        throw new Error(`{% ${name} %} takes nothing after its name`);
      }
    }

    render(ctx: Context, emitter: Emitter): void {
      const helpers = findPageHelpers(ctx.globals);
      if (helpers) emitter.write(read(helpers));
    }
  };
}

function readWidth(value: unknown): number | undefined {
  const width = typeof value === "string" ? Number(value) : value;
  return typeof width === "number" && Number.isInteger(width) && width > 0 && width <= 4000
    ? width
    : undefined;
}

/** "16/9", "16:9", 1.5 or "1.5"; anything else keeps the picture's own shape. */
function readRatio(value: unknown): number | null {
  if (typeof value === "number") return value > 0 && value < 20 ? value : null;
  if (typeof value !== "string") return null;
  const [width, height] = value.split(/[/:]/).map(Number);
  const ratio = height === undefined ? width : (width ?? Number.NaN) / height;
  return ratio !== undefined && Number.isFinite(ratio) && ratio > 0 && ratio < 20 ? ratio : null;
}

/** "main_menu" as "Main menu", for a menu's accessible name. */
function handleInWords(handle: string): string {
  const words = handle.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
