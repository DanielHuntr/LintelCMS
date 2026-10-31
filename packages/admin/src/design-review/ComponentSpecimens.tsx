import { Eye, Globe, Inbox, Languages, Plus, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { ColourSwatches } from "./ColourSwatches.js";
import { SpecimenGroup } from "./SpecimenGroup.js";

type OrderView = "all" | "open" | "shipped";

const orderViews = [
  { value: "all", label: t("designReview.sample.viewAll") },
  { value: "open", label: t("designReview.sample.viewOpen") },
  { value: "shipped", label: t("designReview.sample.viewShipped") },
] as const;

/** Every base component with sample content. Rendered once per colour scheme. */
export function ComponentSpecimens() {
  return (
    <>
      <SpecimenGroup title={t("designReview.typography")}>
        <div className="flex flex-col gap-2">
          <p className="text-large-title">{t("designReview.sample.largeTitle")}</p>
          <p className="text-title">{t("designReview.sample.title")}</p>
          <p className="text-headline">{t("designReview.sample.headline")}</p>
          <p className="text-body">{t("designReview.sample.body")}</p>
          <p className="text-footnote text-label-secondary">{t("designReview.sample.footnote")}</p>
          <p className="text-caption text-label-secondary">{t("designReview.sample.caption")}</p>
        </div>
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.colours")}>
        <ColourSwatches />
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.buttons")}>
        <ButtonSpecimens />
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.textFields")}>
        <div className="flex flex-col gap-5 rounded-card bg-surface p-5">
          <TextField
            label={t("designReview.sample.fieldLabel")}
            placeholder={t("designReview.sample.fieldPlaceholder")}
            hint={t("designReview.sample.fieldHint")}
          />
          <TextField
            label={t("designReview.sample.slugLabel")}
            defaultValue="/about"
            error={t("designReview.sample.slugError")}
          />
        </div>
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.cardsAndBadges")}>
        <Card
          title={t("designReview.sample.cardTitle")}
          accessory={<Badge tone="success">{t("designReview.sample.published")}</Badge>}
        >
          <p className="text-body text-label-secondary">{t("designReview.sample.cardBody")}</p>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Badge>{t("designReview.sample.draft")}</Badge>
          <Badge tone="accent">{t("designReview.sample.scheduled")}</Badge>
          <Badge tone="success">{t("designReview.sample.published")}</Badge>
          <Badge tone="warning">{t("designReview.sample.lowStock")}</Badge>
          <Badge tone="danger">{t("designReview.sample.failed")}</Badge>
        </div>
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.lists")}>
        <ListSpecimen />
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.controls")}>
        <ControlSpecimens />
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.emptyState")}>
        <Card>
          <EmptyState
            icon={Inbox}
            title={t("designReview.sample.emptyTitle")}
            description={t("designReview.sample.emptyDescription")}
            action={
              <Button variant="tinted" icon={<Plus aria-hidden="true" />}>
                {t("designReview.sample.emptyAction")}
              </Button>
            }
          />
        </Card>
      </SpecimenGroup>

      <SpecimenGroup title={t("designReview.largeTitle")}>
        <LargeTitle
          headingLevel={2}
          title={t("designReview.sample.pageTitle")}
          subtitle={t("designReview.sample.pageSubtitle")}
          actions={
            <Button icon={<Plus aria-hidden="true" />}>{t("designReview.sample.add")}</Button>
          }
        />
      </SpecimenGroup>
    </>
  );
}

function ButtonSpecimens() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button>{t("designReview.sample.save")}</Button>
        <Button variant="tinted" icon={<Eye aria-hidden="true" />}>
          {t("designReview.sample.preview")}
        </Button>
        <Button variant="plain">{t("designReview.sample.cancel")}</Button>
        <Button disabled>{t("designReview.sample.save")}</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="small">{t("designReview.sample.save")}</Button>
        <Button size="medium">{t("designReview.sample.save")}</Button>
        <Button size="large">{t("designReview.sample.save")}</Button>
        <Button size="small" variant="tinted">
          {t("designReview.sample.preview")}
        </Button>
      </div>
    </div>
  );
}

function ListSpecimen() {
  const [isInMaintenance, setIsInMaintenance] = useState(false);

  return (
    <GroupedList
      header={t("designReview.sample.listHeader")}
      footer={t("designReview.sample.listFooter")}
    >
      <GroupedListRow
        icon={Languages}
        label={t("designReview.sample.language")}
        detail={t("designReview.sample.languageValue")}
        onSelect={() => undefined}
      />
      <GroupedListRow
        icon={Wrench}
        iconTone="warning"
        label={t("designReview.sample.maintenance")}
        description={t("designReview.sample.maintenanceDescription")}
        accessory={
          <Toggle
            label={t("designReview.sample.maintenance")}
            labelVisibility="hidden"
            checked={isInMaintenance}
            onCheckedChange={setIsInMaintenance}
          />
        }
      />
      <GroupedListRow
        icon={Globe}
        iconTone="success"
        label={t("designReview.sample.domains")}
        accessory={<Badge tone="accent">{t("badge.new")}</Badge>}
        to="/settings"
      />
    </GroupedList>
  );
}

function ControlSpecimens() {
  const [sendsOrderEmails, setSendsOrderEmails] = useState(true);
  const [orderView, setOrderView] = useState<OrderView>("all");

  return (
    <div className="flex flex-col gap-5 rounded-card bg-surface p-5">
      <Toggle
        label={t("designReview.sample.orderEmails")}
        checked={sendsOrderEmails}
        onCheckedChange={setSendsOrderEmails}
      />
      <div className="hairline-top" />
      <SegmentedControl
        label={t("designReview.sample.viewLabel")}
        options={orderViews}
        value={orderView}
        onChange={setOrderView}
      />
    </div>
  );
}
