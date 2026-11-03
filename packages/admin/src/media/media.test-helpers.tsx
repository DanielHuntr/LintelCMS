import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { vi } from "vitest";
import type { Asset } from "./media.api.js";

/** Renders with a fresh query cache, without retries, so each test starts clean and fails fast. */
export function renderWithQueries(ui: ReactElement): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

export function makeAsset(overrides: Partial<Asset> = {}): Asset {
  const id = overrides.id ?? "3f1c2b9a-0d4e-4c5f-9a8b-7c6d5e4f3a2b";
  return {
    id,
    filename: "harbour.jpg",
    mimeType: "image/jpeg",
    size: 482_000,
    width: 1600,
    height: 1000,
    alt: "",
    credit: "",
    focalPoint: { x: 0.5, y: 0.5 },
    url: `http://localhost:4000/media/${id}/file?v=abc`,
    thumbnailUrl: `http://localhost:4000/media/${id}/file?w=400&format=webp&v=abc`,
    createdAt: "2026-10-30T09:15:00.000Z",
    uploadedBy: { id: "user-1", name: "Ada Editor" },
    ...overrides,
  };
}

/**
 * Answers the admin's fetch calls from a function of the request path, and records every
 * path asked for, so tests can check which queries a screen sent.
 */
export function mockApi(respond: (path: string, init: RequestInit | undefined) => unknown) {
  const requestedPaths: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname + new URL(String(input)).search;
    requestedPaths.push(path);
    const body = respond(path, init);
    if (body instanceof Response) return body;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  return requestedPaths;
}
