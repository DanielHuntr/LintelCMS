import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { RevisionHistory } from "./RevisionHistory.js";

afterEach(() => vi.restoreAllMocks());

describe("RevisionHistory", () => {
  it("heads each day one level under History (LINTEL-A11Y-036)", async () => {
    const now = new Date().toISOString();
    mockApi(() => ({
      revisions: [
        {
          id: "r1",
          kind: "edited",
          createdAt: now,
          updatedAt: now,
          restoredFromAt: null,
          author: { id: "u1", name: "Sam Baker" },
        },
      ],
    }));
    renderScreen(
      <RevisionHistory entryId="entry-1" isWorking={false} onRestore={async () => undefined} />,
    );
    expect(await screen.findByRole("heading", { level: 3, name: "Today" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "History" })).toBeInTheDocument();
  });
});
