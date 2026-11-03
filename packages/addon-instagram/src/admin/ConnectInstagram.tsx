import { ApiError, Button, Card, describeError, TextField, useCan } from "@lintel/admin/plugin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { accountKey, connectAccount, postsKey } from "./instagram.api.js";
import { t } from "./strings.js";

const STEPS = ["connect.step1", "connect.step2", "connect.step3", "connect.step4"] as const;

/** Not connected yet: what to do, in four steps, and where to paste the token. */
export function ConnectInstagram() {
  const queryClient = useQueryClient();
  const canConnect = useCan("settings:update");
  const [accessToken, setAccessToken] = useState("");
  const connect = useMutation({
    mutationFn: connectAccount,
    onSuccess: (account) => {
      queryClient.setQueryData(accountKey, account);
      void queryClient.invalidateQueries({ queryKey: postsKey });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (accessToken.trim()) connect.mutate(accessToken.trim());
  };

  return (
    <Card title={t("connect.title")}>
      <p className="text-body text-label-secondary">{t("connect.description")}</p>
      <h3 className="mt-5 text-headline">{t("connect.stepsTitle")}</h3>
      <ol className="mt-2 flex list-decimal flex-col gap-1.5 ps-5 text-body marker:text-label-secondary">
        {STEPS.map((step) => (
          <li key={step}>{t(step)}</li>
        ))}
      </ol>
      {canConnect && (
        <form className="mt-5 flex flex-col gap-3" onSubmit={submit}>
          <TextField
            label={t("connect.tokenLabel")}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            hint={t("connect.tokenHint")}
            error={connect.isError ? connectProblem(connect.error) : undefined}
          />
          <div>
            <Button type="submit" disabled={!accessToken.trim() || connect.isPending}>
              {connect.isPending ? t("connect.working") : t("connect.button")}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

/** Instagram's refusals come back as plain words; anything else is described as usual. */
function connectProblem(error: unknown): string {
  return error instanceof ApiError && error.status < 500 && error.message
    ? error.message
    : describeError(error);
}
