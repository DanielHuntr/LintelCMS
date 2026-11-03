import type { UploadedPageFont } from "@lintel/builder";
import { type ReactNode, useRef, useState } from "react";
import { describeFontError } from "./describeFontError.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddFontDialog } from "./AddFontDialog.js";
import { useAddUploadedFont, useSiteFonts } from "./siteFonts.queries.js";

export interface BuilderFonts {
  /** For PageBuilder's `onAddFont`; undefined for people who may not change the site's fonts. */
  onAddFont: (() => void) | undefined;
  onMoveFontToSite: ((font: UploadedPageFont) => Promise<boolean>) | undefined;
  /** The dialogs these open, to render beside the builder. */
  dialogs: ReactNode;
}

/**
 * What the page builder's font list needs from the admin: "Add a font" opens the same
 * dialog as Settings → Site → Fonts, and a font uploaded to one page can become a site
 * font after the maker confirms their licence covers the web.
 */
export function useBuilderFonts(): BuilderFonts {
  const canChange = useCan("settings:update");
  const [isAdding, setIsAdding] = useState(false);
  const siteFonts = useSiteFonts(isAdding);
  const addUploaded = useAddUploadedFont();
  const toast = useToast();
  const [moving, setMoving] = useState<UploadedPageFont | null>(null);
  const answer = useRef<((moved: boolean) => void) | null>(null);

  const finishMove = (moved: boolean) => {
    answer.current?.(moved);
    answer.current = null;
    setMoving(null);
  };

  const confirmMove = () => {
    if (!moving) return;
    const files = moving.files.flatMap((file) =>
      file.assetId ? [{ assetId: file.assetId, weight: file.weight, style: file.style }] : [],
    );
    if (files.length === 0) {
      toast({ message: t("siteFonts.move.noFiles", { family: moving.family }), tone: "danger" });
      finishMove(false);
      return;
    }
    addUploaded.mutate(
      { family: moving.family, category: moving.category, files, licenceConfirmed: true },
      {
        onSuccess: () => finishMove(true),
        onError: (error) => {
          toast({ message: describeFontError(error), tone: "danger" });
          finishMove(false);
        },
      },
    );
  };

  return {
    onAddFont: canChange ? () => setIsAdding(true) : undefined,
    onMoveFontToSite: canChange
      ? (font) =>
          new Promise<boolean>((resolve) => {
            answer.current = resolve;
            setMoving(font);
          })
      : undefined,
    dialogs: (
      <>
        {isAdding && (
          <AddFontDialog siteFonts={siteFonts.data} onClose={() => setIsAdding(false)} />
        )}
        <ConfirmDialog
          open={moving !== null}
          title={t("siteFonts.move.title", { family: moving?.family ?? "" })}
          message={t("siteFonts.move.message")}
          confirmLabel={t("siteFonts.move.confirm")}
          cancelLabel={t("siteFonts.cancel")}
          isWorking={addUploaded.isPending}
          onConfirm={confirmMove}
          onCancel={() => finishMove(false)}
        />
      </>
    ),
  };
}
