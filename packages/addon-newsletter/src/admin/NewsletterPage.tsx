import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  controlClasses,
  describeError,
  LargeTitle,
  LoadError,
  LoadingRegion,
  PluginBackLink,
  SegmentedControl,
  Skeleton,
  TextField,
  Toggle,
  useCan,
} from "@lintel/admin/plugin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import {
  type ConnectionSummary,
  connectionKey,
  disconnect,
  findLists,
  PROVIDER_NAMES,
  type ProviderId,
  readConnection,
  saveConnection,
} from "./newsletter.api.js";
import { t } from "./strings.js";

/** Settings → Newsletter: which service sign-ups go to, and how. */
export function NewsletterPage() {
  const connection = useQuery({ queryKey: connectionKey, queryFn: readConnection });
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <PluginBackLink to="/settings">{t("newsletter.back")}</PluginBackLink>
      <LargeTitle title={t("newsletter.title")} subtitle={t("newsletter.subtitle")} />
      {connection.isError && (
        <LoadError error={connection.error} onRetry={() => void connection.refetch()} />
      )}
      {connection.isPending && (
        <LoadingRegion label={t("newsletter.loading")}>
          <Skeleton className="h-72" />
        </LoadingRegion>
      )}
      {connection.data && <ConnectionForm saved={connection.data} />}
    </div>
  );
}

const providerOptions = (["mailchimp", "brevo"] as const).map((value) => ({
  value,
  label: PROVIDER_NAMES[value],
}));

function ConnectionForm({ saved }: { saved: ConnectionSummary }) {
  const canChange = useCan("settings:update");
  const queryClient = useQueryClient();
  const listId = useId();
  const [provider, setProvider] = useState<ProviderId>(
    saved.connected ? saved.provider : "mailchimp",
  );
  const [apiKey, setApiKey] = useState("");
  const [chosenList, setChosenList] = useState(saved.connected ? saved.listId : "");
  const [doubleOptIn, setDoubleOptIn] = useState(saved.connected ? saved.doubleOptIn : true);
  const [templateId, setTemplateId] = useState(
    saved.connected && saved.brevoTemplateId !== null ? String(saved.brevoTemplateId) : "",
  );
  const [confirmUrl, setConfirmUrl] = useState(saved.connected ? saved.brevoConfirmUrl : "");
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);

  const usesSavedKey = saved.connected && saved.provider === provider && apiKey === "";
  const savedLists = useQuery({
    queryKey: ["newsletter", "lists", provider],
    queryFn: () => findLists(provider, ""),
    enabled: usesSavedKey,
  });
  const typedLists = useMutation({ mutationFn: () => findLists(provider, apiKey.trim()) });
  const lists = usesSavedKey ? savedLists.data : typedLists.data;
  const listsError = usesSavedKey ? savedLists.error : typedLists.error;

  const save = useMutation({
    mutationFn: () =>
      saveConnection({
        provider,
        ...(apiKey.trim() && { apiKey: apiKey.trim() }),
        listId: chosenList,
        doubleOptIn,
        brevoTemplateId: templateId ? Number(templateId) : null,
        brevoConfirmUrl: confirmUrl.trim(),
      }),
    onSuccess: (summary) => {
      queryClient.setQueryData(connectionKey, summary);
      setApiKey("");
    },
  });
  const remove = useMutation({
    mutationFn: disconnect,
    onSuccess: () => {
      setIsConfirmingDisconnect(false);
      setApiKey("");
      setChosenList("");
      typedLists.reset();
      queryClient.setQueryData(connectionKey, { connected: false });
    },
  });

  const service = PROVIDER_NAMES[provider];
  const showsBrevoExtras = provider === "brevo" && doubleOptIn;

  function chooseProvider(next: ProviderId) {
    setProvider(next);
    setApiKey("");
    setChosenList(saved.connected && saved.provider === next ? saved.listId : "");
    typedLists.reset();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <>
      <Card
        title={
          saved.connected
            ? t("newsletter.connectedTo", { service: PROVIDER_NAMES[saved.provider] })
            : t("newsletter.notConnected")
        }
        accessory={
          saved.connected ? (
            <Badge tone="success">{t("newsletter.connectedList", { list: saved.listName })}</Badge>
          ) : undefined
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <SegmentedControl
            label={t("newsletter.service")}
            options={providerOptions}
            value={provider}
            onChange={chooseProvider}
          />
          <div className="flex flex-col gap-2">
            <TextField
              label={t("newsletter.apiKey")}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              disabled={!canChange}
              onChange={(event) => setApiKey(event.target.value)}
              hint={
                usesSavedKey && saved.connected
                  ? t("newsletter.apiKeySaved", { hint: saved.keyHint })
                  : t(`newsletter.apiKeyHint.${provider}`)
              }
            />
            {apiKey.trim() !== "" && (
              <div>
                <Button
                  type="button"
                  variant="tinted"
                  size="small"
                  disabled={typedLists.isPending}
                  onClick={() => typedLists.mutate()}
                >
                  {t("newsletter.findLists")}
                </Button>
              </div>
            )}
          </div>
          {listsError && (
            <p role="alert" className="text-footnote whitespace-pre-line text-danger">
              {describeError(listsError)}
            </p>
          )}
          {lists && lists.length === 0 && (
            <p className="text-footnote text-label-secondary">
              {t("newsletter.noLists", { service })}
            </p>
          )}
          {lists && lists.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={listId} className="text-footnote font-medium text-label">
                {t("newsletter.list")}
              </label>
              <select
                id={listId}
                className={`${controlClasses()} h-10`}
                value={chosenList}
                disabled={!canChange}
                onChange={(event) => setChosenList(event.target.value)}
              >
                <option value="" disabled>
                  {t("newsletter.chooseList")}
                </option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Toggle
              label={t("newsletter.doubleOptIn")}
              checked={doubleOptIn}
              disabled={!canChange}
              onCheckedChange={setDoubleOptIn}
            />
            <p className="text-footnote text-label-secondary">
              {t(doubleOptIn ? "newsletter.doubleOptInHint" : "newsletter.consentTickHint")}
            </p>
          </div>
          {showsBrevoExtras && (
            <>
              <TextField
                label={t("newsletter.brevoTemplate")}
                type="number"
                min={1}
                inputMode="numeric"
                value={templateId}
                disabled={!canChange}
                hint={t("newsletter.brevoTemplateHint")}
                onChange={(event) => setTemplateId(event.target.value)}
              />
              <TextField
                label={t("newsletter.brevoConfirmUrl")}
                type="url"
                placeholder="https://"
                value={confirmUrl}
                disabled={!canChange}
                onChange={(event) => setConfirmUrl(event.target.value)}
              />
            </>
          )}
          {save.isError && (
            <p role="alert" className="text-footnote whitespace-pre-line text-danger">
              {describeError(save.error)}
            </p>
          )}
          {canChange && (
            <div className="flex items-center justify-end gap-3">
              <p role="status" className="me-auto text-footnote text-label-secondary">
                {save.isSuccess ? t("newsletter.saved") : ""}
              </p>
              {saved.connected && (
                <Button
                  type="button"
                  variant="plain"
                  onClick={() => setIsConfirmingDisconnect(true)}
                >
                  {t("newsletter.disconnect")}
                </Button>
              )}
              <Button type="submit" disabled={save.isPending || chosenList === ""}>
                {saved.connected ? t("newsletter.save") : t("newsletter.connect")}
              </Button>
            </div>
          )}
        </form>
      </Card>
      <p className="px-1 text-footnote text-label-secondary">
        {t("newsletter.howToUse", { service })}
      </p>
      {saved.connected && (
        <ConfirmDialog
          open={isConfirmingDisconnect}
          title={t("newsletter.disconnectTitle", { service: PROVIDER_NAMES[saved.provider] })}
          message={t("newsletter.disconnectMessage")}
          confirmLabel={t("newsletter.disconnect")}
          cancelLabel={t("newsletter.cancel")}
          isDestructive
          isWorking={remove.isPending}
          onConfirm={() => remove.mutate()}
          onCancel={() => setIsConfirmingDisconnect(false)}
        />
      )}
    </>
  );
}
