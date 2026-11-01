import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { describeError } from "../api/describeError.js";
import { getCollection, getEntry } from "../content/content.api.js";
import { viewPageTarget } from "../content/viewPage.js";
import { t } from "../i18n/strings.js";
import { useViewPageSite } from "../website/website.queries.js";
import { BranchActionDialog } from "./BranchActionDialog.js";
import { useContentTree } from "./ContentTreeContext.js";
import { CreateDialog } from "./CreateDialog.js";
import { HostnamesDialog } from "./HostnamesDialog.js";
import { MoveDialog } from "./MoveDialog.js";
import { SortDialog } from "./SortDialog.js";
import type { TreeAction, TreeTarget } from "./treeActions.js";
import type { TreeNotice } from "./TreeToast.js";

export interface PendingAction {
  action: TreeAction;
  target: TreeTarget;
}

interface TreeDialogsProps {
  pending: PendingAction | null;
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
  selectedKey: string | undefined;
}

/** The dialog for the action someone picked from a row's menu, if it asks anything first. */
export function TreeDialogs({ pending, onClose, onNotice, selectedKey }: TreeDialogsProps) {
  const tree = useContentTree();
  if (!pending) return null;
  const { action, target } = pending;

  if (action === "viewPage" && target.kind === "entry") {
    return <OpenViewPage entryId={target.node.id} onDone={onClose} onNotice={onNotice} />;
  }

  if (target.kind === "top") {
    return action === "create" ? (
      <CreateDialog place={null} placeName={undefined} isHome={target.isHome} onClose={onClose} />
    ) : null;
  }

  if (target.kind === "root") {
    const place = { collection: target.root.handle };
    if (action === "create") {
      return <CreateDialog place={place} placeName={target.root.name} onClose={onClose} />;
    }
    if (action === "sort") {
      return <SortDialog place={place} placeName={target.root.name} onClose={onClose} />;
    }
    return null;
  }

  const { node } = target;
  const name = node.title || t("tree.untitled");
  switch (action) {
    case "create":
      return <CreateDialog place={{ parentId: node.id }} placeName={name} onClose={onClose} />;
    case "sort":
      return <SortDialog place={{ parentId: node.id }} placeName={name} onClose={onClose} />;
    case "hostnames":
      return <HostnamesDialog node={node} onClose={onClose} onNotice={onNotice} />;
    case "move":
      return (
        <MoveDialog
          nodes={[node]}
          onMove={(parentId) => tree.moveWithUndo(node, parentId, Number.MAX_SAFE_INTEGER)}
          onClose={onClose}
        />
      );
    case "publish":
    case "unpublish":
    case "duplicate":
    case "delete":
      return (
        <BranchActionDialog
          action={action}
          node={node}
          selectedKey={selectedKey}
          onClose={onClose}
          onNotice={onNotice}
        />
      );
    default:
      return null;
  }
}

interface OpenViewPageProps {
  entryId: string;
  onDone: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/** "View page" from the tree: the live page on the website, or Lintel's own view of it. */
function OpenViewPage({ entryId, onDone, onNotice }: OpenViewPageProps) {
  const siteData = useViewPageSite();
  const navigate = useNavigate();
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!siteData || hasStarted.current) return;
    hasStarted.current = true;
    void (async () => {
      try {
        const entry = await getEntry(entryId);
        const collection = await getCollection(entry.collectionHandle);
        const target = viewPageTarget(siteData, collection, entry);
        if (!target) return;
        if (target.kind === "website") window.open(target.href, "_blank", "noopener");
        else
          await navigate({
            to: "/content/$collection/$entryId/view",
            params: { collection: target.collection, entryId: target.entryId },
          });
      } catch (error) {
        onNotice({ tone: "danger", message: describeError(error) });
      } finally {
        onDone();
      }
    })();
  }, [siteData, entryId, navigate, onDone, onNotice]);

  return null;
}
