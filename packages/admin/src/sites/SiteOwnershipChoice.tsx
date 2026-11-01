import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { useCurrentSite } from "./SiteContext.js";

/**
 * "Every site" or "Only <current site>", for things a site can keep to itself, such as a
 * taxonomy. Shown only when there are several sites; `onChange` gets the site's handle, or
 * null for every site.
 */
export function SiteOwnershipChoice({
  label,
  ownedBySite,
  onChange,
}: {
  label: string;
  ownedBySite: boolean;
  onChange: (siteHandle: string | null) => void;
}) {
  const current = useCurrentSite();
  if (!current?.hasSeveralSites) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="text-footnote font-medium text-label">
        {label}
      </span>
      <SegmentedControl
        label={label}
        value={ownedBySite ? "site" : "every"}
        onChange={(value) => onChange(value === "site" ? current.site.handle : null)}
        options={[
          { value: "every", label: t("sites.everySite") },
          { value: "site", label: t("sites.onlySite", { name: current.site.name }) },
        ]}
      />
    </div>
  );
}
