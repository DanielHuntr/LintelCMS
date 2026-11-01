import { gzipSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "@playwright/test";

/** The value under which `fraction` of the measurements fall (0.95 for the p95). */
export function percentile(measurements: number[], fraction: number): number {
  const sorted = [...measurements].sort((first, second) => first - second);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/** How long each of `times` requests to `url` takes, one after another, in milliseconds. */
export async function timeRequests(
  url: string,
  times: number,
  headers: Record<string, string>,
): Promise<number[]> {
  const durations: number[] = [];
  for (let attempt = 0; attempt < times; attempt++) {
    const started = performance.now();
    const response = await fetch(url, { headers });
    await response.arrayBuffer();
    if (!response.ok) {
      throw new Error(`${url} answered ${response.status}`);
    }
    durations.push(performance.now() - started);
  }
  return durations;
}

/** The files index.html loads straight away (scripts and preloads), with their gzipped sizes. */
export async function initialAssets(buildFolder: string) {
  const html = await readFile(join(buildFolder, "index.html"), "utf8");
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(
    (match) => match[1] ?? "",
  );
  return Promise.all(
    [...new Set(paths)].map(async (path) => {
      const contents = await readFile(join(buildFolder, path));
      return { path, gzippedBytes: gzipSync(contents).length };
    }),
  );
}

/** Largest Contentful Paint of the page as loaded, read from the browser's own timing. */
export async function largestContentfulPaint(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          resolve(entries[entries.length - 1]?.startTime ?? 0);
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
}
