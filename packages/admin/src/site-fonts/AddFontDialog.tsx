import { useState } from "react";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { AdobeFontsTab } from "./AdobeFontsTab.js";
import { GoogleFontsTab } from "./GoogleFontsTab.js";
import type { SiteFonts } from "./siteFonts.api.js";
import { UploadFontsTab } from "./UploadFontsTab.js";

type Source = "google" | "upload" | "adobe";

/**
 * "Add a font", in three places a font can come from. Google Fonts is first: it needs
 * nothing but a name. Each tab closes the dialog once its font is added.
 */
export function AddFontDialog({
  siteFonts,
  onClose,
}: {
  siteFonts: SiteFonts | undefined;
  onClose: () => void;
}) {
  const [source, setSource] = useState<Source>("google");
  return (
    <Dialog
      open
      size="wide"
      title={t("siteFonts.dialog.title")}
      onClose={onClose}
      bodyClassName="flex min-h-0 flex-1 flex-col gap-4 px-6 pb-5"
    >
      <SegmentedControl
        label={t("siteFonts.dialog.source")}
        value={source}
        onChange={setSource}
        options={[
          { value: "google", label: t("siteFonts.source.google") },
          { value: "upload", label: t("siteFonts.source.upload") },
          { value: "adobe", label: t("siteFonts.source.adobe") },
        ]}
      />
      {source === "google" && <GoogleFontsTab siteFonts={siteFonts} onAdded={onClose} />}
      {source === "upload" && <UploadFontsTab onAdded={onClose} />}
      {source === "adobe" && <AdobeFontsTab onAdded={onClose} />}
    </Dialog>
  );
}
