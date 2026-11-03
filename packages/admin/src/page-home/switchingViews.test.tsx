import type * as Builder from "@lintel/builder";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contentKeys } from "../content/content.queries.js";
import type { Entry } from "../content/content.types.js";
import { samplePost } from "../content/testEntries.js";
import { PageDesignPage } from "../page-design/PageDesignPage.js";
import { apiErrorResponse } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { useViewSwitch } from "./useViewSwitch.js";

interface StubProps {
  finishEditingRef?: { current: (() => Promise<void>) | null };
  onChange: (document: unknown) => void;
  onSaveNow?: () => void;
  toolbarAfterTitle?: React.ReactNode;
  siteDesign?: { onChange?: (value: unknown) => void };
  siteSections?: { onChange?: (change: unknown) => void };
}

// The real builder needs a canvas; these tests are about what surrounds it.
vi.mock("@lintel/builder", async (original) => ({
  ...(await original<typeof Builder>()),
  PageBuilder: function StubBuilder(props: StubProps) {
    const [isTyping, setIsTyping] = useState(false);
    const { finishEditingRef, onChange } = props;
    useEffect(() => {
      if (!finishEditingRef) return;
      // As the canvas does: words being typed only arrive when typing ends.
      finishEditingRef.current = async () => {
        if (isTyping) onChange({ root: { children: [], edit: "typed" } });
      };
    }, [finishEditingRef, isTyping, onChange]);
    return (
      <header>
        {props.toolbarAfterTitle}
        <button
          type="button"
          onClick={() => props.onChange({ root: { children: [], edit: "first" } })}
        >
          First edit
        </button>
        <button
          type="button"
          onClick={() => props.onChange({ root: { children: [], edit: "second" } })}
        >
          Second edit
        </button>
        <button type="button" onClick={() => setIsTyping(true)}>
          Type on the canvas
        </button>
        <button type="button" onClick={() => props.onSaveNow?.()}>
          Save now
        </button>
        <button
          type="button"
          onClick={() => props.siteDesign?.onChange?.({ variables: [], sharedStyles: [] })}
        >
          Change a style
        </button>
        <button type="button" onClick={() => props.siteSections?.onChange?.({ footer: null })}>
          Change the footer
        </button>
      </header>
    );
  },
}));

function samplePage(): Entry {
  const post = samplePost();
  return samplePost({
    data: { title: "Home", design: null },
    blueprint: {
      ...post.blueprint,
      fields: [
        { handle: "title", label: "Title", type: "text", required: true, options: {} },
        { handle: "design", label: "Design", type: "page", required: false, options: {} },
      ],
    },
  });
}

type Request = { method: string; path: string; body: { data?: { design?: unknown } } };

/** The API, able to take its time or fail. `onSave` answers saves of the page. */
function api(answers: {
  onSave?: (request: Request) => Promise<Response | undefined> | Response | undefined;
  onOther?: (request: Request) => Response | undefined;
}) {
  const saves: Request[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = (typeof init?.body === "string" ? JSON.parse(init.body) : {}) as Request["body"];
    const request = { method, path: url.pathname, body };
    if (method === "GET" && url.pathname === "/entries/p1") {
      return new Response(JSON.stringify(samplePage()));
    }
    if (method === "GET" && url.pathname === "/website/design") {
      return new Response(JSON.stringify({ variables: [], sharedStyles: [], revision: "r1" }));
    }
    if (method === "GET" && url.pathname === "/website/sections") {
      return new Response(JSON.stringify({ navigation: null, footer: null }));
    }
    if (method !== "GET" && url.pathname === "/entries/p1") {
      saves.push(request);
      const answer = await answers.onSave?.(request);
      return (
        answer ??
        new Response(JSON.stringify({ ...samplePage(), data: { title: "Home", ...body.data } }))
      );
    }
    return answers.onOther?.(request) ?? apiErrorResponse(404, "NOT_FOUND", "Not found");
  });
  return { saves };
}

const designPath = "/content/pages/p1/design/design";

async function openDesigner() {
  const screenParts = renderScreen(
    <PageDesignPage collectionHandle="pages" entryId="p1" fieldHandle="design" />,
    { initialPath: designPath },
  );
  const banner = await screen.findByRole("banner");
  return {
    ...screenParts,
    banner,
    content: within(banner).getByRole("radio", { name: "Content" }),
  };
}

afterEach(() => vi.restoreAllMocks());

const stillHereMessage = /couldn’t be saved, so you’re still here/;

describe("leaving the designer when a save fails", () => {
  it("stays with the edit after a server error, says so, and goes once it saves", async () => {
    const user = userEvent.setup();
    let isDown = true;
    const { saves } = api({
      onSave: () => (isDown ? apiErrorResponse(500, "INTERNAL", "Broken") : undefined),
    });
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(content);

    expect(await screen.findByText(stillHereMessage)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(designPath);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saves).toHaveLength(1);

    isDown = false;
    await user.click(content);

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves).toHaveLength(2);
    expect(saves[1]?.body.data?.design).toEqual({ root: { children: [], edit: "first" } });
  });

  it("stays when the server can't be reached", async () => {
    const user = userEvent.setup();
    const { saves } = api({
      onSave: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(content);

    expect(await screen.findByText(stillHereMessage)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(designPath);
    expect(saves).toHaveLength(1);
  });

  it("stays when someone else changed the site's styles, and offers this person's back", async () => {
    const user = userEvent.setup();
    api({
      onOther: ({ method, path }) =>
        method === "PUT" && path === "/website/design"
          ? apiErrorResponse(409, "SITE_DESIGN_CHANGED", "Changed")
          : undefined,
    });
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "Change a style" }));
    await user.click(content);

    expect(await screen.findByText(/Someone else changed the site's styles/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use my version" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(designPath);
  });

  it("stays when the site's styles or footer can't be saved", async () => {
    const user = userEvent.setup();
    api({
      onOther: ({ method, path }) =>
        method === "PUT" && path === "/website/sections"
          ? apiErrorResponse(500, "INTERNAL", "Broken")
          : undefined,
    });
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "Change the footer" }));
    await user.click(content);

    expect(await screen.findByText(stillHereMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(designPath);
  });
});

describe("leaving the designer with an edit waiting", () => {
  it("saves it, and the page's Content view opens with it", async () => {
    const user = userEvent.setup();
    const { saves } = api({});
    const { router, content, queryClient } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(content);

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves).toHaveLength(1);
    const cached = queryClient.getQueryData<Entry>(contentKeys.entry("p1"));
    expect(cached?.data.design).toEqual({ root: { children: [], edit: "first" } });
  });

  it("keeps words still being typed on the canvas when the press comes straight after", async () => {
    const user = userEvent.setup();
    const { saves } = api({});
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "Type on the canvas" }));
    await user.click(content);

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves).toHaveLength(1);
    expect(saves[0]?.body.data?.design).toEqual({ root: { children: [], edit: "typed" } });
  });

  it("includes an edit made just before the press, while a save is running", async () => {
    const user = userEvent.setup();
    let finishFirstSave: () => void = () => undefined;
    const firstSave = new Promise<undefined>((resolve) => {
      finishFirstSave = () => resolve(undefined);
    });
    const { saves } = api({ onSave: () => (saves.length === 1 ? firstSave : undefined) });
    const { router, content, queryClient } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(screen.getByRole("button", { name: "Save now" }));
    await waitFor(() => expect(saves).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Second edit" }));
    await user.click(content);
    expect(router.state.location.pathname).toBe(designPath);

    finishFirstSave();

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves).toHaveLength(2);
    expect(saves[1]?.body.data?.design).toEqual({ root: { children: [], edit: "second" } });
    const cached = queryClient.getQueryData<Entry>(contentKeys.entry("p1"));
    expect(cached?.data.design).toEqual({ root: { children: [], edit: "second" } });
  });

  it("includes an edit made after the press, while the switch is saving", async () => {
    const user = userEvent.setup();
    let finishFirstSave: () => void = () => undefined;
    const firstSave = new Promise<undefined>((resolve) => {
      finishFirstSave = () => resolve(undefined);
    });
    const { saves } = api({ onSave: () => (saves.length === 1 ? firstSave : undefined) });
    const { router, content } = await openDesigner();

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(content);
    await waitFor(() => expect(saves).toHaveLength(1));
    await user.click(screen.getByRole("button", { name: "Second edit" }));

    finishFirstSave();

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves.at(-1)?.body.data?.design).toEqual({ root: { children: [], edit: "second" } });
  });
});

describe("pressing the switch twice", () => {
  it("saves once and moves once", async () => {
    const user = userEvent.setup();
    let finishSave: () => void = () => undefined;
    const slowSave = new Promise<undefined>((resolve) => {
      finishSave = () => resolve(undefined);
    });
    const { saves } = api({ onSave: () => slowSave });
    const { router, content } = await openDesigner();
    const steps = router.history.length;

    await user.click(screen.getByRole("button", { name: "First edit" }));
    await user.click(content);
    await user.click(content);
    await waitFor(() => expect(saves).toHaveLength(1));
    finishSave();

    await waitFor(() => expect(router.state.location.pathname).toBe("/content/pages/p1"));
    expect(saves).toHaveLength(1);
    expect(router.history.length).toBe(steps + 1);
  });
});

describe("useViewSwitch", () => {
  const options = () => ({
    current: "content" as const,
    saveFirst: vi.fn(async () => true),
    go: vi.fn(),
  });

  it("goes once for two presses of the same view", async () => {
    const switching = options();
    const { result } = renderHook(() => useViewSwitch(switching));

    await act(async () => {
      await Promise.all([result.current.request("design"), result.current.request("design")]);
    });

    expect(switching.go).toHaveBeenCalledTimes(1);
    expect(switching.go).toHaveBeenCalledWith("design");
    expect(switching.saveFirst).toHaveBeenCalledTimes(1);
  });

  it("goes by the last press when someone changes their mind", async () => {
    const switching = options();
    const { result } = renderHook(() => useViewSwitch(switching));

    await act(async () => {
      await Promise.all([result.current.request("design"), result.current.request("content")]);
    });

    expect(switching.go).not.toHaveBeenCalled();
  });

  it("doesn't go when a save fails, and says so", async () => {
    const switching = { ...options(), saveFirst: vi.fn(async () => false) };
    const { result } = renderHook(() => useViewSwitch(switching));

    await act(() => result.current.request("design"));

    expect(switching.go).not.toHaveBeenCalled();
    expect(result.current.didFail).toBe(true);
  });

  it("can try again after a failed save", async () => {
    const switching = options();
    switching.saveFirst.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useViewSwitch(switching));

    await act(() => result.current.request("design"));
    await act(() => result.current.request("design"));

    expect(switching.go).toHaveBeenCalledTimes(1);
    expect(result.current.didFail).toBe(false);
  });
});
