import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { describeError } from "../api/describeError.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { ContentTree } from "./ContentTree.js";
import { ContentTreeContext, type ContentTreeState } from "./ContentTreeContext.js";
import { moveEntry } from "./contentTree.api.js";
import type { TreeNode } from "./contentTree.types.js";
import { useEntryPath, useRefreshContent } from "./contentTree.queries.js";
import { selectedTreeKey } from "./selectedTreeKey.js";
import { TreeDialogs, type PendingAction } from "./TreeDialogs.js";
import type { TreeAction, TreeTarget } from "./treeActions.js";
import { TREE_WIDTH, rootKey, useExpandedBranches, useTreeWidth } from "./treeState.js";
import { TreeToast, type TreeNotice } from "./TreeToast.js";

const SITE_STORAGE_KEY = "lintel.contentTree.site";

/**
 * The Content section's frame: the content tree in a resizable pane beside the main
 * navigation, and the workspace (whatever the address opens) beside it. Opening something
 * changes the address but not the frame, so the tree keeps its place and the back button
 * works as people expect.
 */
export function ContentSection() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const selectedKey = selectedTreeKey(pathname);
  const [siteId, setSiteId] = useState<string | undefined>(
    () => window.localStorage.getItem(SITE_STORAGE_KEY) ?? undefined,
  );
  const branches = useExpandedBranches(siteId ?? "main");
  const { width, setWidth } = useTreeWidth();
  const [dragged, setDragged] = useState<TreeNode | undefined>();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<TreeNotice | null>(null);
  const refresh = useRefreshContent();
  const canUpdate = useCan("entries:update");

  // Opening an entry from elsewhere (a link, search, the back button) opens its branch.
  const isEntry = selectedKey !== undefined && !selectedKey.includes(":");
  const path = useEntryPath(isEntry ? selectedKey : undefined);
  const { open } = branches;
  useEffect(() => {
    const steps = path.data?.path;
    const top = steps?.[0];
    if (!steps || !top) return;
    open([rootKey(top.collection.handle), ...steps.slice(0, -1).map((step) => step.id)]);
  }, [path.data, open]);

  function show(next: Omit<TreeNotice, "id">) {
    setNotice({ ...next, id: Date.now() });
  }

  async function moveWithUndo(node: TreeNode, parentId: string | null, index: number) {
    const title = node.title || t("tree.untitled");
    try {
      const { previous } = await moveEntry(node.id, parentId, index);
      if (parentId !== null) open([parentId]);
      await refresh([node.id]);
      show({
        tone: "neutral",
        message: t("tree.moved", { title }),
        action: {
          label: t("tree.undo"),
          run: () =>
            void moveEntry(node.id, previous.parentId, previous.index).then(async () => {
              await refresh([node.id]);
              show({ tone: "neutral", message: t("tree.moveUndone", { title }) });
            }),
        },
      });
    } catch (error) {
      show({
        tone: "danger",
        message: t("tree.moveFailed", { title, reason: describeError(error) }),
      });
    }
  }

  function runAction(action: TreeAction, target: TreeTarget) {
    if (target.kind === "root" && action === "openList") {
      void navigate({ to: "/content/$collection", params: { collection: target.root.handle } });
      return;
    }
    const tab = target.kind === "entry" ? workspaceTab(action) : undefined;
    if (target.kind === "entry" && tab) {
      void navigate({
        to: "/content/$collection/$entryId",
        params: { collection: target.node.collection.handle, entryId: target.node.id },
        search: tab === "preview" ? { preview: true } : { tab },
      });
      return;
    }
    setPending({ action, target });
  }

  const state: ContentTreeState = {
    siteId,
    setSiteId: (next) => {
      setSiteId(next);
      if (next) window.localStorage.setItem(SITE_STORAGE_KEY, next);
    },
    expanded: branches.expanded,
    toggle: branches.toggle,
    open,
    selectedKey,
    runAction,
    dragged,
    setDragged,
    moveWithUndo,
    canUpdate,
  };

  return (
    <ContentTreeContext value={state}>
      <div style={{ "--tree-width": `${width}px` } as CSSProperties} className="pl-(--tree-width)">
        <nav
          aria-label={t("tree.label")}
          data-content-tree=""
          className="fixed inset-y-3 left-[264px] z-10 flex w-(--tree-width) flex-col rounded-panel bg-sidebar shadow-float hairline-ring backdrop-blur-2xl backdrop-saturate-150"
        >
          <ContentTree />
          <TreeToast notice={notice} onDismiss={() => setNotice(null)} />
          <ResizeHandle width={width} onResize={setWidth} />
        </nav>
        <Outlet />
      </div>
      <TreeDialogs
        pending={pending}
        onClose={() => setPending(null)}
        onNotice={show}
        selectedKey={selectedKey}
      />
    </ContentTreeContext>
  );
}

/** Actions that simply open part of an entry's workspace, rather than asking something first. */
function workspaceTab(action: TreeAction): "history" | "info" | "children" | "preview" | undefined {
  if (action === "history" || action === "info" || action === "preview") return action;
  return action === "openList" ? "children" : undefined;
}

interface ResizeHandleProps {
  width: number;
  onResize: (width: number) => void;
}

/**
 * The tree pane's right edge: drag it, or focus it and use the arrow keys (as a separator,
 * the ARIA way to resize a pane).
 */
function ResizeHandle({ width, onResize }: ResizeHandleProps) {
  const start = useRef<{ x: number; width: number } | null>(null);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("tree.resize")}
      aria-valuemin={TREE_WIDTH.minimum}
      aria-valuemax={TREE_WIDTH.maximum}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, width };
      }}
      onPointerMove={(event) => {
        if (start.current) onResize(start.current.width + event.clientX - start.current.x);
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? 40 : 10;
        if (event.key === "ArrowLeft") onResize(width - step);
        else if (event.key === "ArrowRight") onResize(width + step);
        else return;
        event.preventDefault();
      }}
      className="absolute inset-y-4 -right-1.5 w-3 cursor-col-resize rounded-full outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full hover:after:bg-accent/40 focus-visible:after:bg-accent"
    />
  );
}
