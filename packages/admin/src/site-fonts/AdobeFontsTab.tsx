import { type FormEvent, useState } from "react";
import { describeFontError } from "./describeFontError.js";
import { Button } from "../design/Button.js";
import { TextField } from "../design/TextField.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { useConnectAdobeProject } from "./siteFonts.queries.js";

/**
 * Connects an Adobe Fonts web project by its ID. Lintel reads the project to list its
 * fonts; Adobe serves them, so the site's address must be added to the project in Adobe
 * Fonts, which the note under the field says in one line.
 */
export function AdobeFontsTab({ onAdded }: { onAdded: () => void }) {
  const [projectId, setProjectId] = useState("");
  const connect = useConnectAdobeProject();
  const toast = useToast();

  function submit(event: FormEvent) {
    event.preventDefault();
    connect.mutate(projectId.trim(), {
      onSuccess: (fonts) => {
        const count = fonts.fonts.filter(
          (font) => font.sourceId === projectId.trim().toLowerCase(),
        ).length;
        toast({ message: t("siteFonts.adobe.connected", { count }), tone: "neutral" });
        onAdded();
      },
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        data-autofocus
        label={t("siteFonts.adobe.projectId")}
        hint={t("siteFonts.adobe.hint")}
        value={projectId}
        maxLength={40}
        autoComplete="off"
        spellCheck={false}
        error={connect.isError ? describeFontError(connect.error) : undefined}
        onChange={(event) => {
          connect.reset();
          setProjectId(event.target.value);
        }}
      />
      <p className="text-footnote text-label-secondary">
        {t("siteFonts.adobe.note")} {t("siteFonts.adobe.consent")}
      </p>
      <div className="flex justify-end">
        <Button type="submit" disabled={!projectId.trim() || connect.isPending}>
          {connect.isPending ? t("siteFonts.adobe.connecting") : t("siteFonts.adobe.connect")}
        </Button>
      </div>
    </form>
  );
}
