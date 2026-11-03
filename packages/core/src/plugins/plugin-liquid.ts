import type { FastifyBaseLogger } from "fastify";
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
import {
  findPageHelpers,
  type LiquidPageHelpers,
} from "../liquid-templates/liquid-page-helpers.js";
import { createPluginContext, pluginLog, type PluginContext } from "./plugin-context.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { findEnabledPluginIds } from "./plugins.service.js";

/**
 * A Liquid tag a plugin adds to the site's templates:
 *
 *   {% opening_hours_table %}
 *   {% opening_hours_today label: "Open today" %}
 *   {% colour_swatches_chip entry.data.colour size: 24 %}
 *
 * A tag takes an optional value and then `name: value` options. What `render` returns is
 * written into the page as HTML, so escape every value you put in it (`escapeHtml`).
 */
export interface PluginLiquidTag<Settings = unknown> {
  name: string;
  render(
    input: { value: unknown; options: Record<string, unknown> },
    context: PluginContext<Settings>,
  ): string | Promise<string>;
}

/**
 * A Liquid filter: `{{ entry.data.colour | colour_swatches_name }}`. It is given the value
 * before the bar and anything after the colon. What it returns is escaped, unless `html`
 * is true, which says it returns HTML it made safe itself.
 */
export interface PluginLiquidFilter {
  name: string;
  html?: boolean;
  apply(value: unknown, ...filterArguments: unknown[]): unknown;
}

export interface PluginLiquid<Settings = unknown> {
  tags?: readonly PluginLiquidTag<Settings>[];
  filters?: readonly PluginLiquidFilter[];
}

/** Tag and filter names start with the plugin id, dashes as underscores, and an underscore. */
export function pluginLiquidPrefix(pluginId: string): string {
  return `${pluginId.replaceAll("-", "_")}_`;
}

const LIQUID_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/** A problem with a plugin's Liquid names, for the catalogue's checks; undefined when fine. */
export function findLiquidProblem(plugin: LintelPlugin): string | undefined {
  const prefix = pluginLiquidPrefix(plugin.id);
  const names = [
    ...(plugin.liquid?.tags ?? []).map((tag) => tag.name),
    ...(plugin.liquid?.filters ?? []).map((filter) => filter.name),
  ];
  const stray = names.find((name) => !LIQUID_NAME_PATTERN.test(name) || !name.startsWith(prefix));
  return stray === undefined
    ? undefined
    : `its Liquid tag or filter "${stray}" should be lowercase and start with "${prefix}".`;
}

interface RegisteredLiquid {
  plugin: LintelPlugin;
  logger: FastifyBaseLogger;
}

/**
 * The plugins whose tags and filters every Liquid engine gets, as the catalogue registered
 * them. Engines are made again when templates change, so they read this list each time.
 */
const registered = new Map<string, RegisteredLiquid>();

export function registerPluginLiquid(plugin: LintelPlugin, logger: FastifyBaseLogger): void {
  if (plugin.liquid) registered.set(plugin.id, { plugin, logger });
}

/** Adds every registered plugin's tags and filters to an engine. */
export function addPluginLiquid(engine: Liquid): void {
  for (const { plugin, logger } of registered.values()) {
    for (const tag of plugin.liquid?.tags ?? []) {
      engine.registerTag(tag.name, pluginTagClass(plugin, tag, logger));
    }
    for (const filter of plugin.liquid?.filters ?? []) {
      engine.registerFilter(filter.name, {
        raw: filter.html === true,
        handler: async function (this: { context: Context }, value: unknown, ...rest: unknown[]) {
          const helpers = findPageHelpers(this.context.globals);
          if (!(await isOn(helpers, plugin))) return value;
          try {
            return await filter.apply(value, ...rest);
          } catch (error) {
            logger.error({ plugin: plugin.id, err: error }, `The ${filter.name} filter failed`);
            return value;
          }
        },
      });
    }
  }
}

async function isOn(helpers: LiquidPageHelpers | undefined, plugin: LintelPlugin) {
  if (!helpers) return false;
  return (await findEnabledPluginIds(helpers.database)).includes(plugin.id);
}

function pluginTagClass(
  plugin: LintelPlugin,
  definition: PluginLiquidTag,
  logger: FastifyBaseLogger,
) {
  return class PluginTag extends Tag {
    private readonly valueToken: ValueToken | undefined;
    private readonly options: Hash;

    constructor(token: TagToken, remainTokens: TopLevelToken[], liquid: Liquid) {
      super(token, remainTokens, liquid);
      this.valueToken = startsWithOption(this.tokenizer) ? undefined : this.tokenizer.readValue();
      this.options = new Hash(this.tokenizer);
    }

    *render(ctx: Context, emitter: Emitter): Generator<unknown, void, unknown> {
      const value: unknown = this.valueToken ? yield evalToken(this.valueToken, ctx) : undefined;
      const options = (yield this.options.render(ctx)) as Record<string, unknown>;
      const helpers = findPageHelpers(ctx.globals);
      const on = (yield isOn(helpers, plugin)) as boolean;
      if (!on || !helpers) return;
      try {
        const html = (yield definition.render(
          { value, options },
          createPluginContext(plugin, helpers.database, pluginLog(plugin.id, logger)),
        )) as string;
        emitter.write(typeof html === "string" ? html : "");
      } catch (error) {
        // One add-on's tag failing leaves a gap in the page, not an error page.
        logger.error({ plugin: plugin.id, err: error }, `The ${definition.name} tag failed`);
      }
    }
  };
}

/** Whether the tag's arguments begin with `name:`, so there is no value before the options. */
function startsWithOption(tokenizer: Tag["tokenizer"]): boolean {
  const start = tokenizer.p;
  tokenizer.skipBlank();
  if (tokenizer.end()) return true;
  const identifier = tokenizer.readIdentifier();
  tokenizer.skipBlank();
  const isOption = identifier.content !== "" && tokenizer.peek() === ":";
  tokenizer.p = start;
  return isOption;
}
