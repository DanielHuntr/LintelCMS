import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { contentKeys, useCollections } from "../content/content.queries.js";
import type { Collection } from "../content/content.types.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { savePreviewUrlPattern } from "./preview.api.js";

/**
 * "Live preview" on a content type's page: where each collection using it shows drafts
 * on the real website. Shown to people who may change collections.
 */
export function PreviewAddressSettings({ blueprintHandle }: { blueprintHandle: string }) {
  const canEdit = useCan("collections:update");
  const collections = useCollections();
  const using = (collections.data ?? []).filter(
    (collection) => collection.blueprintHandle === blueprintHandle,
  );
  if (!canEdit || using.length === 0) return null;

  return (
    <section
      id="live-preview"
      aria-labelledby="live-preview-heading"
      className="mt-8 flex scroll-mt-20 flex-col gap-2"
    >
      <div className="px-1">
        <h2 id="live-preview-heading" className="text-headline text-label">
          {t("preview.settings.title")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("preview.settings.description")}</p>
      </div>
      <div className="flex flex-col gap-5 rounded-card bg-surface p-5">
        {using.map((collection) => (
          <PreviewAddressForm key={collection.handle} collection={collection} />
        ))}
      </div>
    </section>
  );
}

function PreviewAddressForm({ collection }: { collection: Collection }) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(collection.previewUrlPattern ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | undefined>();
  const isUnchanged = address.trim() === (collection.previewUrlPattern ?? "");

  async function save(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError(undefined);
    try {
      const updated = await savePreviewUrlPattern(collection.handle, address.trim() || null);
      queryClient.setQueryData(contentKeys.collection(updated.handle), updated);
      await queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      setStatus("saved");
    } catch (failure) {
      setError(describeError(failure));
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="flex items-start gap-3">
      <TextField
        label={t("preview.settings.address", { name: collection.name })}
        hint={t("preview.settings.addressHint")}
        error={error}
        value={address}
        inputMode="url"
        spellCheck={false}
        autoCapitalize="off"
        placeholder="https://"
        onChange={(event) => {
          setAddress(event.target.value);
          setStatus("idle");
        }}
        // min-w-0 lets the address box narrow, so the row fits a 320px screen (LINTEL-A11Y-003).
        className="min-w-0 flex-1 [&_input]:font-mono [&_input]:text-footnote"
      />
      <div className="mt-6 flex shrink-0 items-center gap-2">
        <Button type="submit" variant="tinted" disabled={status === "saving" || isUnchanged}>
          {status === "saving" ? t("preview.settings.saving") : t("preview.settings.save")}
        </Button>
        <p role="status" className="text-footnote text-success">
          {status === "saved" ? t("preview.settings.saved") : ""}
        </p>
      </div>
    </form>
  );
}
