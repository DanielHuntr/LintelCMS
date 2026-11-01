import {
  ArrowUpDown,
  Copy,
  Eye,
  EyeOff,
  FolderInput,
  History,
  Info,
  List,
  type LucideIcon,
  Plus,
  Send,
  SquareArrowOutUpRight,
  Trash2,
} from "lucide-react";
import { t, type StringKey } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { useContentTree } from "./ContentTreeContext.js";
import type { ActionItem } from "./TreeActionsMenu.js";
import { actionsFor, type TreeAction, type TreeTarget } from "./treeActions.js";

const appearance: Record<TreeAction, { label: StringKey; icon: LucideIcon }> = {
  create: { label: "tree.action.create", icon: Plus },
  duplicate: { label: "tree.action.duplicate", icon: Copy },
  move: { label: "tree.action.move", icon: FolderInput },
  sort: { label: "tree.action.sort", icon: ArrowUpDown },
  publish: { label: "tree.action.publish", icon: Send },
  unpublish: { label: "tree.action.unpublish", icon: EyeOff },
  preview: { label: "tree.action.preview", icon: Eye },
  viewPage: { label: "tree.action.viewPage", icon: SquareArrowOutUpRight },
  history: { label: "tree.action.history", icon: History },
  info: { label: "tree.action.info", icon: Info },
  delete: { label: "tree.action.delete", icon: Trash2 },
  openList: { label: "tree.action.openList", icon: List },
};

/** The "…" menu's items for a row: what this person may do with it, in menu order. */
export function useActionItems(target: TreeTarget): ActionItem[] {
  const { runAction } = useContentTree();
  const permissions = {
    create: useCan("entries:create"),
    update: useCan("entries:update"),
    publish: useCan("entries:publish"),
    delete: useCan("entries:delete"),
  };
  return actionsFor(target, permissions).map((action) => ({
    key: action,
    label: t(appearance[action].label),
    icon: appearance[action].icon,
    tone: action === "delete" ? "danger" : "default",
    onSelect: () => runAction(action, target),
  }));
}
