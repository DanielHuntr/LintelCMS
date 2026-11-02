import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { describeError } from "../api/describeError.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { useCurrentSite } from "../sites/SiteContext.js";
import { ContentTree } from "./ContentTree.js";
import { ContentTreeContext, type ContentTreeState } from "./ContentTreeContext.js";
import { moveEntry } from "./contentTree.api.js";
import type { AddressChange, TreeNode } from "./contentTree.types.js";
import { RedirectsDialog } from "./RedirectsDialog.js";
import { useEntryPath, useRefreshContent } from "./contentTree.queries.js";
import { selectedTreeKey } from "./selectedTreeKey.js";
import { TreeDialogs, type PendingAction } from "./TreeDialogs.js";
import type { TreeAction, TreeTarget } from "./treeActions.js";
import { TREE_WIDTH, rootKey, useExpandedBranches, useTreeWidth } from "./treeState.js";
import { TreeToast, type TreeNotice } from "./TreeToast.js";
import { useTreeSelection } from "./treeSelection.js";
import { rememberFolderView } from "../content-workspace/folderView.js";

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
  // The tree shows the site the admin works on (the sidebar's site switcher), so what is
  // created, sorted or found here is that site's.
  const current = useCurrentSite();
  const siteId = current?.site.id;
  const branches = useExpandedBranches(siteId ?? "main");
  const { width, setWidth } = useTreeWidth();
  const [dragged, setDragged] = useState<TreeNode | undefined>();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notice, setNotice] = useState<TreeNotice | null>(null);
  const refresh = useRefreshContent();
  const canUpdate = useCan("entries:update");
  const canManageRedirects = useCan("settings:update");
  const isSeoOn = useSession().enabledPlugins.includes("seo");
  const [redirectOffer, setRedirectOffer] = useState<AddressChange[] | null>(null);
  const treeElement = useRef<HTMLElement>(null);
  const selection = useTreeSelection(useCallback(() => treeElement.current, []));

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
      const { previous, addressChanges } = await moveEntry(node.id, parentId, index);
      if (parentId !== null) open([parentId]);
      await refresh([node.id]);
      const undo = {
        label: t("tree.undo"),
        run: () =>
          void moveEntry(node.id, previous.parentId, previous.index).then(async () => {
            await refresh([node.id]);
            show({ tone: "neutral", message: t("tree.moveUndone", { title }) });
          }),
      };
      // Redirects are the SEO tools' and a settings change, so they're offered when both allow.
      const offersRedirects = addressChanges.length > 0 && isSeoOn && canManageRedirects;
      show({
        tone: "neutral",
        message: movedMessage(title, addressChanges.length),
        actions: offersRedirects
          ? [undo, { label: t("tree.addRedirects"), run: () => setRedirectOffer(addressChanges) }]
          : [undo],
      });
    } catch (error) {
      show({
        tone: "danger",
        message: t("tree.moveFailed", { title, reason: describeError(error) }),
      });
    }
  }

  function announceSorted(addressChanges: AddressChange[]) {
    if (addressChanges.length === 0) return;
    const offersRedirects = isSeoOn && canManageRedirects;
    show({
      tone: "neutral",
      message: t("tree.sort.addressesChanged", { count: addressChanges.length }),
      actions: offersRedirects
        ? [{ label: t("tree.addRedirects"), run: () => setRedirectOffer(addressChanges) }]
        : [],
    });
  }

  function runAction(action: TreeAction, target: TreeTarget) {
    if (target.kind === "root" && action === "openList") {
      rememberFolderView(target.root.handle, "list");
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
    expanded: branches.expanded,
    toggle: branches.toggle,
    open,
    selectedKey,
    runAction,
    dragged,
    setDragged,
    moveWithUndo,
    announceSorted,
    canUpdate,
    selection: selection.ids,
    selectedNodes: selection.nodes,
    selectNode: (node, gesture) =>
      selection.select(
        node,
        gesture,
        selectedKey !== undefined && !selectedKey.includes(":") ? selectedKey : null,
      ),
    extendSelection: selection.extendTo,
    clearSelection: selection.clear,
    rememberNode: selection.rememberNode,
    notify: show,
  };

  return (
    <ContentTreeContext value={state}>
      <div style={{ "--tree-width": `${width}px` } as CSSProperties} className="pl-(--tree-width)">
        <nav
          ref={treeElement}
          aria-label={t("tree.label")}
          data-content-tree=""
          onKeyDown={(event) => {
            if (event.key !== "Escape" || selection.ids.size === 0) return;
            if ((event.target as Element).closest("input, textarea, [role=menu]")) return;
            event.preventDefault();
            selection.clear();
          }}
          className="fixed inset-y-3 inset-s-[264px] z-10 flex w-(--tree-width) flex-col rounded-panel bg-sidebar shadow-float hairline-ring backdrop-blur-2xl backdrop-saturate-150"
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
      {redirectOffer && (
        <RedirectsDialog
          changes={redirectOffer}
          onClose={() => setRedirectOffer(null)}
          onNotice={show}
        />
      )}
    </ContentTreeContext>
  );
}

function movedMessage(title: string, changedAddresses: number): string {
  if (changedAddresses === 0) return t("tree.moved", { title });
  if (changedAddresses === 1) return t("tree.movedAddressesOne", { title });
  return t("tree.movedAddresses", { title, count: changedAddresses });
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
      className="absolute inset-y-4 -inset-e-1.5 w-3 cursor-col-resize rounded-full outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded-full hover:after:bg-accent/40 focus-visible:after:bg-accent"
    />
  );
}
