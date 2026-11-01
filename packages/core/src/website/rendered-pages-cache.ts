/**
 * Finished responses of the built-in website, kept in memory so most visits cost no
 * database query and no rendering. Anything that could change a page empties it: content
 * events (publishing, unpublishing, deleting, scheduled publishing) and every successful
 * change made through the admin API, such as a menu, a global or a setting (see
 * `clearRenderedPagesAfterChanges`). Entries also expire after a while, as a safety net.
 *
 * Drafts shown with a preview token are never kept here.
 */

export interface SiteResponse {
  statusCode: number;
  headers: Readonly<Record<string, string>>;
  body: string;
}

interface CachedResponse {
  response: SiteResponse;
  storedAt: number;
}

export interface RenderedPagesCacheOptions {
  /** How many pages to keep; the oldest go first. */
  maxPages?: number;
  /** How long a page is kept at most. */
  maxAgeMilliseconds?: number;
  now?: () => number;
}

/** The part of the cache one site's pages use (see `RenderedPagesCache.forSite`). */
export interface PageCache {
  find(key: string): SiteResponse | undefined;
  store(key: string, response: SiteResponse): void;
  shareValue<Value>(key: string, load: () => Promise<Value>): Promise<Value>;
}

export class RenderedPagesCache implements PageCache {
  private readonly pages = new Map<string, CachedResponse>();
  private readonly shared = new Map<string, { value: Promise<unknown>; storedAt: number }>();
  private readonly maxPages: number;
  private readonly maxAgeMilliseconds: number;
  private readonly now: () => number;

  constructor(options: RenderedPagesCacheOptions = {}) {
    this.maxPages = options.maxPages ?? 1000;
    this.maxAgeMilliseconds = options.maxAgeMilliseconds ?? 10 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  find(key: string): SiteResponse | undefined {
    const cached = this.pages.get(key);
    if (!cached) {
      return undefined;
    }
    if (this.now() - cached.storedAt > this.maxAgeMilliseconds) {
      this.pages.delete(key);
      return undefined;
    }
    return cached.response;
  }

  store(key: string, response: SiteResponse): void {
    this.pages.delete(key);
    this.pages.set(key, { response, storedAt: this.now() });
    if (this.pages.size > this.maxPages) {
      const oldest = this.pages.keys().next().value;
      if (oldest !== undefined) {
        this.pages.delete(oldest);
      }
    }
  }

  /**
   * Something every page uses (the menu, the theme), worked out once and shared until the
   * cache is emptied.
   */
  shareValue<Value>(key: string, load: () => Promise<Value>): Promise<Value> {
    const existing = this.shared.get(key);
    if (existing && this.now() - existing.storedAt <= this.maxAgeMilliseconds) {
      return existing.value as Promise<Value>;
    }
    const loading = load();
    this.shared.set(key, { value: loading, storedAt: this.now() });
    // A failure isn't kept, so the next visit tries again.
    loading.catch(() => this.shared.delete(key));
    return loading;
  }

  /**
   * The same cache for one site's pages: several sites share one server, and the same
   * address ("/about") is a different page on each. Emptying the cache empties every site's.
   */
  forSite(siteId: string): PageCache {
    const keyFor = (key: string) => `${siteId}:${key}`;
    return {
      find: (key) => this.find(keyFor(key)),
      store: (key, response) => this.store(keyFor(key), response),
      shareValue: (key, load) => this.shareValue(keyFor(key), load),
    };
  }

  get size(): number {
    return this.pages.size;
  }

  clear(): void {
    this.pages.clear();
    this.shared.clear();
  }
}
