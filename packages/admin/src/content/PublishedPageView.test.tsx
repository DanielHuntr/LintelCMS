import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { PublishedPageView } from "./PublishedPageView.js";
import { postBlueprint, postsCollection, samplePost } from "./testEntries.js";

afterEach(() => vi.restoreAllMocks());

describe("View page without a connected website", () => {
  it("shows the published version under a note on connecting a site", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/collections/posts") return postsCollection;
      if (url.pathname === "/entries/p1") return samplePost({ status: "published" });
      if (url.pathname === "/blueprints/post") return postBlueprint;
      if (url.pathname === "/delivery/posts/hello-world") {
        return {
          id: "p1",
          slug: "hello-world",
          url: "/blog/hello-world",
          publishedAt: "2026-10-01T09:00:00.000Z",
          data: { title: "Hello world", excerpt: "The live excerpt", category: "news" },
        };
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<PublishedPageView collectionHandle="posts" entryId="p1" />);

    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent(
      "Lintel isn’t connected to a website yet. This is a simple preview. Connect your site in Settings → Your website.",
    );
    expect(
      screen.getByRole("link", { name: "Connect your site in Settings → Your website." }),
    ).toHaveAttribute("href", "/settings/site");
    expect(
      screen.getByRole("link", { name: "How to build a site with the Next.js starter" }),
    ).toHaveAttribute("href", expect.stringContaining("nextjs-starter"));
    expect(await screen.findByText("The live excerpt")).toBeInTheDocument();
    expect(
      calls
        .find((call) => call.url.pathname.startsWith("/delivery"))
        ?.url.searchParams.get("locale"),
    ).toBe("en-GB");
  });
});
