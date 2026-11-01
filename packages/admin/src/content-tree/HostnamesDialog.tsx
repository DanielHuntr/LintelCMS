import { useId, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { saveRootHostnames } from "./contentTree.api.js";
import type { RootHostnames, TreeNode } from "./contentTree.types.js";
import { useRefreshContent, useRootHostnames } from "./contentTree.queries.js";
import type { TreeNotice } from "./TreeToast.js";

interface HostnamesDialogProps {
  node: TreeNode;
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/**
 * "Hostnames" for a page at the top of the tree, like Umbraco's "Culture and hostnames": a
 * domain and/or a path that it and everything under it answers on. Both empty is the
 * default: the home page for the first page at the top, its own name for the others.
 */
export function HostnamesDialog({ node, onClose, onNotice }: HostnamesDialogProps) {
  const hostnames = useRootHostnames(node.id);
  const [isWorking, setIsWorking] = useState(false);
  const formId = useId();
  const title = node.title || t("tree.untitled");
  const current = hostnames.data;

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("tree.hostnames.title", { title })}
      description={t("tree.hostnames.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={!current || isWorking}>
            {t("tree.hostnames.save")}
          </Button>
        </>
      }
    >
      {hostnames.isError && (
        <LoadError error={hostnames.error} onRetry={() => void hostnames.refetch()} />
      )}
      {hostnames.isPending && (
        <LoadingRegion label={t("tree.hostnames.loading")}>
          <Skeleton className="h-32 w-full" />
        </LoadingRegion>
      )}
      {current && (
        <HostnamesForm
          formId={formId}
          node={node}
          current={current}
          onWorking={setIsWorking}
          onClose={onClose}
          onNotice={onNotice}
        />
      )}
    </Dialog>
  );
}

interface HostnamesFormProps {
  formId: string;
  node: TreeNode;
  current: RootHostnames;
  onWorking: (isWorking: boolean) => void;
  onClose: () => void;
  onNotice: (notice: Omit<TreeNotice, "id">) => void;
}

/** The fields, starting from what is saved, once it has loaded. */
function HostnamesForm({
  formId,
  node,
  current,
  onWorking,
  onClose,
  onNotice,
}: HostnamesFormProps) {
  const refresh = useRefreshContent();
  const [hostname, setHostname] = useState(current.hostname);
  const [pathPrefix, setPathPrefix] = useState(current.pathPrefix);
  const [error, setError] = useState<string | null>(null);
  const title = node.title || t("tree.untitled");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onWorking(true);
    setError(null);
    try {
      const saved = await saveRootHostnames(node.id, { hostname, pathPrefix });
      await refresh([node.id]);
      onNotice({ tone: "neutral", message: t("tree.hostnames.saved", { title, url: saved.url }) });
      onClose();
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      onWorking(false);
    }
  }

  return (
    <form
      id={formId}
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-5"
    >
      <div className="rounded-control bg-fill/60 px-3 py-2.5">
        <p className="text-footnote text-label-secondary">{t("tree.hostnames.now")}</p>
        <p className="font-mono text-body text-label">{current.url}</p>
        {!current.isAssigned && (
          <p className="mt-1 text-footnote text-label-secondary">
            {current.isDefault ? t("tree.hostnames.defaultHome") : t("tree.hostnames.defaultSlug")}
          </p>
        )}
      </div>
      <TextField
        label={t("tree.hostnames.domainLabel")}
        placeholder={t("tree.hostnames.domainPlaceholder")}
        hint={t("tree.hostnames.domainHint")}
        value={hostname}
        onChange={(event) => setHostname(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        data-autofocus=""
      />
      <TextField
        label={t("tree.hostnames.prefixLabel")}
        placeholder={t("tree.hostnames.prefixPlaceholder")}
        hint={t("tree.hostnames.prefixHint")}
        value={pathPrefix}
        onChange={(event) => setPathPrefix(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        error={error ?? undefined}
      />
    </form>
  );
}
