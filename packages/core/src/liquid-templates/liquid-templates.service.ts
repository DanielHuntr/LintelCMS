import { existsSync, type FSWatcher, watch } from "node:fs";
import { basename, dirname } from "node:path";
import type { Liquid } from "liquidjs";
import { listCollectionsWithDetails } from "../collections/collections.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createLiquidEngine } from "./liquid-engine.js";
import { DESIGNED_CHOICE, readTemplateChoice, TEMPLATE_CHOICE_KEY } from "./template-choice.js";
import { findStoredTemplateChoice } from "./template-choice.repository.js";
import { listTemplateNames } from "./templates-folder.repository.js";
import type { LiquidTemplateList, TemplateSummary } from "./liquid-templates.schema.js";

export interface LiquidTemplatesOptions {
  /** The templates folder: LINTEL_TEMPLATES, `site/` at the repository root by default. */
  folder: string;
  /** Development: pick up changed files straight away, and show template errors on the page. */
  development?: boolean;
}

/**
 * The templates folder of an install (`server.website.liquidTemplates`): which templates
 * there are, which one an entry's page uses, and the engine that draws them. Parsed
 * templates and the list are kept until a file changes; in development a watcher notices
 * that, starts afresh and calls `onChange` so the rendered pages are emptied too.
 */
export class LiquidTemplates {
  private engine: Liquid;
  private names: Promise<string[]> | null = null;
  private watcher: FSWatcher | null = null;
  private changeTimer: NodeJS.Timeout | null = null;

  constructor(
    readonly options: LiquidTemplatesOptions,
    private readonly onChange: () => void = () => {},
  ) {
    this.engine = createLiquidEngine(options.folder, { cache: true });
  }

  get showsErrors(): boolean {
    return this.options.development === true;
  }

  /** The page templates there are ("page", "pages/wide"); none without the folder. */
  listTemplateNames(): Promise<string[]> {
    if (!this.names) {
      this.names = listTemplateNames(this.options.folder);
      this.names.catch(() => {
        this.names = null;
      });
    }
    return this.names;
  }

  async listTemplates(collectionHandles: readonly string[]): Promise<TemplateSummary[]> {
    const names = await this.listTemplateNames();
    return names.map((name) => ({
      name,
      collectionHandle: collectionHandles.includes(name) ? name : null,
    }));
  }

  /**
   * The template an entry's page is drawn with, or null for the built-in one: the entry's
   * own choice when that template exists, else its collection's when there is one.
   * "Designed" always means the built-in template.
   */
  async chooseTemplate(collectionHandle: string, choice: unknown): Promise<string | null> {
    const chosen = readTemplateChoice({ [TEMPLATE_CHOICE_KEY]: choice });
    if (chosen === DESIGNED_CHOICE) return null;
    const names = await this.listTemplateNames();
    if (chosen !== undefined && names.includes(chosen)) return chosen;
    return names.includes(collectionHandle) ? collectionHandle : null;
  }

  /** The template for an entry, reading its stored choice (published, or the draft's). */
  async findTemplateForEntry(
    database: DatabaseOrTransaction,
    entry: { id: string; collectionHandle: string },
    copy: "published" | "draft",
  ): Promise<string | null> {
    if ((await this.listTemplateNames()).length === 0) return null;
    const choice = await findStoredTemplateChoice(database, entry.id, copy);
    return this.chooseTemplate(entry.collectionHandle, choice);
  }

  /** Draws a template with these globals (which partials and layouts see too). */
  render(name: string, globals: Record<string, unknown>): Promise<string> {
    return this.engine.renderFile(name, {}, { globals }) as Promise<string>;
  }

  /** Development: watch the folder (or, until it exists, for it to appear). */
  startWatching(): void {
    if (!this.options.development || this.watcher) return;
    const { folder } = this.options;
    try {
      this.watcher = existsSync(folder)
        ? watch(folder, { recursive: true }, () => this.changed())
        : watch(dirname(folder), (_event, file) => {
            if (file === basename(folder)) {
              this.stopWatching();
              this.changed();
              this.startWatching();
            }
          });
    } catch {
      // Watching is a convenience; without it, a restart picks changes up.
      this.watcher = null;
    }
  }

  stopWatching(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.changeTimer) clearTimeout(this.changeTimer);
    this.changeTimer = null;
  }

  /** Forgets the parsed templates and the list, and tells the website to draw pages again. */
  changed(): void {
    if (this.changeTimer) clearTimeout(this.changeTimer);
    // Editors save in bursts; one fresh start after they settle is enough.
    this.changeTimer = setTimeout(() => {
      this.changeTimer = null;
      this.engine = createLiquidEngine(this.options.folder, { cache: true });
      this.names = null;
      this.onChange();
    }, 50);
  }
}

/**
 * `GET /website/liquid-templates`: the templates an entry can choose, for the editor's
 * sidebar. Empty when the install has no templates folder, so the choice isn't shown.
 */
export async function listTemplatesForEditor(
  database: DatabaseOrTransaction,
  templates: LiquidTemplates | null,
): Promise<LiquidTemplateList> {
  if (!templates) return { templates: [] };
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  return {
    templates: await templates.listTemplates(collections.map(({ handle }) => handle)),
  };
}
