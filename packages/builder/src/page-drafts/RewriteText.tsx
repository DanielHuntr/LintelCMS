import type { PageNode } from "@lintel/builder-model";
import { useEffect, useRef, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { type RewriteStyle, rewriteStyles, usePageDrafting } from "./page-drafting.js";

interface RewriteTextProps {
  node: PageNode;
  isLocked: boolean;
  /** Puts the new words in place, as one change that Undo takes back. */
  onRewrite: (text: string) => void;
}

/**
 * "Rewrite this" under a heading's or paragraph's words: shorter, friendlier or more formal.
 * Shown only with page drafting set up; the words go to this site's own server, nowhere else.
 * Given a `key` of the element's id, so choosing another element drops a rewrite under way.
 */
export function RewriteText({ node, isLocked, onRewrite }: RewriteTextProps) {
  const text = useBuilderText();
  const drafting = usePageDrafting();
  const [writing, setWriting] = useState<RewriteStyle | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const stopper = useRef<AbortController | null>(null);
  useEffect(() => () => stopper.current?.abort(), []);

  const words = node.props.text;
  if (
    !drafting?.isReady ||
    typeof words !== "string" ||
    words.trim() === "" ||
    node.bindings?.text
  ) {
    return null;
  }

  async function rewrite(style: RewriteStyle) {
    if (!drafting || typeof words !== "string") return;
    const controller = new AbortController();
    stopper.current = controller;
    setWriting(style);
    setMessage(null);
    try {
      const rewritten = await drafting.rewrite(
        { text: words, style },
        { signal: controller.signal, onProgress: () => {} },
      );
      if (controller.signal.aborted) return;
      onRewrite(rewritten);
      setMessage(text("pageBuilder.rewrite.done"));
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (!controller.signal.aborted) setWriting(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 pt-1 pb-3">
      <p className="text-caption text-label-secondary">{text("pageBuilder.rewrite.label")}</p>
      <div className="flex flex-wrap gap-1">
        {rewriteStyles.map((style) => (
          <button
            key={style}
            type="button"
            disabled={isLocked || writing !== null}
            onClick={() => void rewrite(style)}
            className="h-7 rounded-control bg-fill px-2.5 text-footnote text-label hover:bg-fill-strong focus-visible:focus-ring disabled:opacity-50"
          >
            {writing === style
              ? text("pageBuilder.rewrite.writing")
              : text(`pageBuilder.rewrite.${style}`)}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="text-caption text-label-tertiary">
        {message}
      </p>
    </div>
  );
}
