import { FileCode2, Lock } from "lucide-react";
import { t } from "../i18n/strings.js";
import { useContentModelStatus } from "./contentModelSync.queries.js";

/**
 * Says, at the top of a content types, taxonomies, global fields or menus screen, that
 * this part of the site is set up in code: locked here ("Managed in code"), or editable
 * here with changes saved to the files too (on a developer's computer). Shows nothing
 * when the site isn't managed in code.
 */
export function ManagedInCodeBanner() {
  const status = useContentModelStatus().data;
  if (!status?.managedInCode) {
    return null;
  }
  const locked = !status.editableInAdmin;
  const Icon = locked ? Lock : FileCode2;
  const folder = <code className="font-mono text-footnote">{status.folder}</code>;
  const [before, after] = t(
    locked ? "modelSync.lockedDescription" : "modelSync.editableDescription",
  ).split("{folder}");

  return (
    <section
      aria-labelledby="managed-in-code-title"
      className="mb-6 flex gap-3 rounded-card bg-surface p-4"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div>
        <h2 id="managed-in-code-title" className="text-headline">
          {t(locked ? "modelSync.lockedTitle" : "modelSync.editableTitle")}
        </h2>
        <p className="mt-0.5 text-body text-label-secondary">
          {before}
          {folder}
          {after}
        </p>
      </div>
    </section>
  );
}
