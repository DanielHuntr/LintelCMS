import { type ReactNode, useCallback, useState } from "react";
import { PublishWithParentDialog } from "../content-workspace/PublishWithParentDialog.js";
import { t } from "../i18n/strings.js";
import { getEntryInfo } from "./contentTree.api.js";
import type { TreeNode } from "./contentTree.types.js";

type Page = { id: string; title: string };

interface Question {
  pages: Page[];
  ancestors: Page[];
  answer: (extraIds: string[] | null) => void;
}

/**
 * The pages above these that aren't published, top down and once each, leaving out pages
 * being published anyway. Only pages that aren't live yet are asked about, as in the editor.
 */
async function findUnpublishedParents(nodes: readonly TreeNode[]) {
  const publishing = new Set(nodes.map((node) => node.id));
  const notLive = nodes.filter((node) => node.status !== "published");
  const infos = await Promise.all(notLive.map((node) => getEntryInfo(node.id)));
  const ancestors = new Map<string, Page>();
  const pages: Page[] = [];
  infos.forEach((info, index) => {
    const above = info.unpublishedAncestors.filter((ancestor) => !publishing.has(ancestor.id));
    if (above.length === 0) return;
    pages.push({ id: notLive[index]!.id, title: notLive[index]!.title });
    for (const ancestor of above) ancestors.set(ancestor.id, ancestor);
  });
  return { pages, ancestors: [...ancestors.values()] };
}

/**
 * Publishing from the tree asks the editor's question when a page would go live under a
 * page that isn't (LINTEL-LEFT-005): publish with the pages above, this page only, or not.
 * `ask` resolves to the extra pages to publish first ([] for none), or null to cancel.
 */
export function useUnpublishedParentQuestion(): {
  ask: (nodes: readonly TreeNode[]) => Promise<string[] | null>;
  dialog: ReactNode;
} {
  const [question, setQuestion] = useState<Question | null>(null);

  const ask = useCallback(async (nodes: readonly TreeNode[]) => {
    const { pages, ancestors } = await findUnpublishedParents(nodes);
    if (ancestors.length === 0) return [];
    return new Promise<string[] | null>((resolve) =>
      setQuestion({
        pages,
        ancestors,
        answer: (extraIds) => {
          setQuestion(null);
          resolve(extraIds);
        },
      }),
    );
  }, []);

  const dialog = question && (
    <PublishWithParentDialog
      open
      title={question.pages[0]?.title || t("tree.untitled")}
      ancestors={question.ancestors}
      pageCount={question.pages.length}
      isWorking={false}
      error={null}
      onPublishWithParent={() => question.answer(question.ancestors.map((page) => page.id))}
      onPublishAlone={() => question.answer([])}
      onCancel={() => question.answer(null)}
    />
  );
  return { ask, dialog };
}
