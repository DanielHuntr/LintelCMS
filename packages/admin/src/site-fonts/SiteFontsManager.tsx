import { fontCatalogue } from "@lintel/builder-model";
import { Plus, Trash2, Type } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { describeFontError } from "./describeFontError.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { AddFontDialog } from "./AddFontDialog.js";
import { describeWeights, fallbackFor, sourceName } from "./fontLabels.js";
import type { SiteFont, SiteFonts } from "./siteFonts.api.js";
import {
  useDisconnectAdobeProject,
  useFontPreview,
  useRemoveSiteFont,
  useSiteFonts,
} from "./siteFonts.queries.js";

/**
 * The site's fonts: each one previewed in itself, where it came from and its weights, with
 * Remove; Adobe Fonts projects, with Disconnect; and "Add a font". `canChange` is false for
 * people who may only look.
 */
export function SiteFontsManager({ canChange }: { canChange: boolean }) {
  const fonts = useSiteFonts();
  const [isAdding, setIsAdding] = useState(false);

  if (fonts.isError) {
    return <LoadError error={fonts.error} onRetry={() => void fonts.refetch()} />;
  }
  if (fonts.isPending) {
    return (
      <LoadingRegion label={t("siteFonts.loading")}>
        <Skeleton className="h-40 rounded-card" />
      </LoadingRegion>
    );
  }
  const ownFonts = fonts.data.fonts.filter((font) => font.source !== "adobe");

  return (
    <div className="flex flex-col gap-6">
      {ownFonts.length === 0 && fonts.data.adobeProjects.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={Type}
            title={t("siteFonts.empty.title")}
            description={t("siteFonts.empty.description")}
            action={
              canChange && (
                <Button
                  icon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setIsAdding(true)}
                >
                  {t("siteFonts.add")}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title-3 text-label">{t("siteFonts.listHeader")}</h2>
            {canChange && (
              <Button
                variant="tinted"
                icon={<Plus aria-hidden="true" className="size-4" />}
                onClick={() => setIsAdding(true)}
              >
                {t("siteFonts.add")}
              </Button>
            )}
          </div>
          {ownFonts.length > 0 && (
            <ul
              aria-label={t("siteFonts.listHeader")}
              className="overflow-hidden rounded-card bg-surface"
            >
              {ownFonts.map((font) => (
                <FontRow key={font.id} font={font} canChange={canChange} />
              ))}
            </ul>
          )}
          <AdobeProjects fonts={fonts.data} canChange={canChange} />
        </>
      )}
      <p className="px-1 text-footnote text-label-secondary">
        {t("siteFonts.included", { count: fontCatalogue.length })}
      </p>
      {isAdding && <AddFontDialog siteFonts={fonts.data} onClose={() => setIsAdding(false)} />}
    </div>
  );
}

function FontRow({ font, canChange }: { font: SiteFont; canChange: boolean }) {
  const remove = useRemoveSiteFont();
  const toast = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const file =
    font.files.find((candidate) => candidate.weight === "400" && candidate.style === "normal") ??
    font.files[0];
  const previewFamily = useFontPreview(file?.url || undefined, false);

  return (
    <li className="flex min-h-16 items-center gap-4 px-4 py-3 not-last:hairline-bottom">
      <span
        aria-hidden="true"
        className="w-12 shrink-0 text-center text-title-2 text-label"
        style={{
          fontFamily: previewFamily
            ? `"${previewFamily}", ${fallbackFor[font.category]}`
            : undefined,
        }}
      >
        {t("siteFonts.preview")}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-label">{font.family}</span>
        <span className="truncate text-footnote text-label-secondary">
          {sourceName(font.source)} · {describeWeights(font.weights, font.hasItalic)}
        </span>
      </span>
      {canChange && (
        <button
          type="button"
          aria-label={t("siteFonts.remove", { family: font.family })}
          onClick={() => setIsConfirming(true)}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-label-secondary hover:bg-fill hover:text-danger focus-visible:focus-ring"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
      )}
      <ConfirmDialog
        open={isConfirming}
        title={t("siteFonts.removeTitle", { family: font.family })}
        message={t("siteFonts.removeMessage")}
        confirmLabel={t("siteFonts.removeConfirm")}
        cancelLabel={t("siteFonts.cancel")}
        isDestructive
        isWorking={remove.isPending}
        onCancel={() => setIsConfirming(false)}
        onConfirm={() =>
          remove.mutate(font.id, {
            onSuccess: () => {
              setIsConfirming(false);
              toast({ message: t("siteFonts.removed", { family: font.family }), tone: "neutral" });
            },
            onError: (error) => {
              setIsConfirming(false);
              toast({ message: describeFontError(error), tone: "danger" });
            },
          })
        }
      />
    </li>
  );
}

function AdobeProjects({ fonts, canChange }: { fonts: SiteFonts; canChange: boolean }) {
  const disconnect = useDisconnectAdobeProject();
  if (fonts.adobeProjects.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <ul className="overflow-hidden rounded-card bg-surface">
        {fonts.adobeProjects.map((project) => (
          <li
            key={project.projectId}
            className="flex min-h-16 items-center gap-4 px-4 py-3 not-last:hairline-bottom"
          >
            <span
              aria-hidden="true"
              className="w-12 shrink-0 text-center text-title-2 text-label-secondary"
            >
              {t("siteFonts.preview")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body text-label">
                {t("siteFonts.adobeProject", { projectId: project.projectId })}
              </span>
              <span className="truncate text-footnote text-label-secondary">
                {project.families.join(", ")}
              </span>
            </span>
            {canChange && (
              <Button
                variant="plain"
                size="small"
                aria-label={t("siteFonts.disconnectLabel", { projectId: project.projectId })}
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate(project.projectId)}
              >
                {t("siteFonts.disconnect")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <p className="px-4 text-footnote text-label-secondary">{t("siteFonts.adobe.note")}</p>
    </div>
  );
}
