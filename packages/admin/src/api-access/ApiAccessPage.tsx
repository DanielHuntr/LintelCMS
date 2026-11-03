import { BookOpen, Braces, Webhook } from "lucide-react";
import { apiUrl } from "../api/client.js";
import { BackLink } from "../design/BackLink.js";
import { CopyButton } from "../design/CopyButton.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { DeliveryAccessSettings } from "./DeliveryAccessSettings.js";
import { TokenList } from "./TokenList.js";
import { Page } from "../design/Page.js";

/**
 * /build/api: how websites, apps and scripts reach the content. Where the APIs are,
 * the reference, who may read, and the tokens.
 */
export function ApiAccessPage() {
  const canChange = useCan("settings:update");
  const restAddress = `${apiUrl}/delivery`;
  const graphqlAddress = `${apiUrl}/graphql`;

  return (
    <Page width="readable">
      <BackLink to="/build">{t("nav.build")}</BackLink>
      <LargeTitle title={t("apiAccess.title")} subtitle={t("apiAccess.subtitle")} />
      <div className="flex flex-col gap-8">
        <GroupedList
          header={t("apiAccess.addressesHeader")}
          footer={t("apiAccess.addressesFooter")}
        >
          <GroupedListRow
            icon={Webhook}
            label={t("apiAccess.restLabel")}
            description={restAddress}
            accessory={
              <CopyButton value={restAddress} label={t("apiAccess.copyRest")} variant="plain" />
            }
          />
          <GroupedListRow
            icon={Braces}
            label={t("apiAccess.graphqlLabel")}
            description={graphqlAddress}
            accessory={
              <CopyButton
                value={graphqlAddress}
                label={t("apiAccess.copyGraphql")}
                variant="plain"
              />
            }
          />
          <GroupedListRow
            icon={BookOpen}
            iconTone="success"
            label={t("apiReference.title")}
            description={t("apiAccess.referenceDescription")}
            to="/build/api/reference"
          />
        </GroupedList>

        <DeliveryAccessSettings canChange={canChange} />
        <TokenList canChange={canChange} />
      </div>
    </Page>
  );
}
