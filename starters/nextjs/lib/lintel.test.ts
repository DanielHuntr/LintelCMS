import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostData } from "./content-types";
import {
  getEntry,
  LintelRequestError,
  LintelUnreachableError,
  listAllEntries,
  listEntries,
} from "./lintel";

const post = {
  id: "3f0b6a2e-8a4f-4c1e-9d7a-1b2c3d4e5f60",
  slug: "hello-world",
  url: "/blog/hello-world",
  publishedAt: "2026-10-30T09:15:00.000Z",
  data: { title: "Hello, world", excerpt: null, featured_image: null, body: null, category: null },
};

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("LINTEL_API_URL", "https://cms.example.com/");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function lastRequest(): { url: string; init: RequestInit & { next?: unknown } } {
  const [url, init] = fetchMock.mock.lastCall ?? [];
  return { url: String(url), init: init ?? {} };
}

describe("getEntry", () => {
  it("reads one published entry, cached for a minute and tagged for revalidation", async () => {
    fetchMock.mockResolvedValue(Response.json(post));

    const entry = await getEntry<PostData>("posts", "hello-world");

    expect(entry?.data.title).toBe("Hello, world");
    expect(lastRequest().url).toBe("https://cms.example.com/delivery/posts/hello-world");
    expect(lastRequest().init.next).toEqual({ revalidate: 60, tags: ["lintel", "lintel:posts"] });
  });

  it("gives null for an entry that isn't published, so the page can 404", async () => {
    fetchMock.mockResolvedValue(Response.json({ code: "NOT_FOUND" }, { status: 404 }));

    expect(await getEntry("posts", "a-draft")).toBeNull();
  });

  it("keeps odd slugs inside the address", async () => {
    fetchMock.mockResolvedValue(Response.json(post));

    await getEntry("pages", "../setup");

    expect(lastRequest().url).toBe("https://cms.example.com/delivery/pages/..%2Fsetup");
  });

  it("says plainly when Lintel isn't running", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const failure = getEntry("posts", "hello-world");

    await expect(failure).rejects.toBeInstanceOf(LintelUnreachableError);
    await expect(failure).rejects.toThrow(/Can't reach Lintel at https:\/\/cms\.example\.com/);
  });

  it("passes on Lintel's own message for other errors", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ code: "INTERNAL", message: "The database is down" }, { status: 500 }),
    );

    const failure = getEntry("posts", "hello-world");

    await expect(failure).rejects.toBeInstanceOf(LintelRequestError);
    await expect(failure).rejects.toThrow("The database is down");
  });
});

describe("listEntries", () => {
  it("asks for one page of a collection", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [post], total: 1 }));

    const list = await listEntries<PostData>("posts", { page: 2, perPage: 10 });

    expect(list?.total).toBe(1);
    expect(lastRequest().url).toBe("https://cms.example.com/delivery/posts?page=2&perPage=10");
  });

  it("gives null when the collection doesn't exist, such as a site without a blog", async () => {
    fetchMock.mockResolvedValue(Response.json({ code: "NOT_FOUND" }, { status: 404 }));

    expect(await listEntries("posts")).toBeNull();
  });
});

describe("listAllEntries", () => {
  it("keeps asking until it has every entry", async () => {
    const hundred = Array.from({ length: 100 }, (_, index) => ({ ...post, slug: `post-${index}` }));
    fetchMock
      .mockResolvedValueOnce(Response.json({ items: hundred, total: 101 }))
      .mockResolvedValueOnce(Response.json({ items: [post], total: 101 }));

    const entries = await listAllEntries("posts");

    expect(entries).toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastRequest().url).toContain("page=2&perPage=100");
  });
});
