import { CloudOff } from "lucide-react";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { t } from "../i18n/strings.js";
import { describeError } from "./describeError.js";

interface LoadErrorProps {
  error: unknown;
  /** Usually the query's `refetch`. */
  onRetry: () => void;
}

/** Shown in place of something that couldn't load: what went wrong, and a way to try again. */
export function LoadError({ error, onRetry }: LoadErrorProps) {
  return (
    <div role="alert">
      <EmptyState
        icon={CloudOff}
        title={t("error.loadTitle")}
        description={describeError(error)}
        action={
          <Button variant="tinted" onClick={onRetry}>
            {t("error.retry")}
          </Button>
        }
      />
    </div>
  );
}
