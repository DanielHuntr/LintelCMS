import { useQueryClient } from "@tanstack/react-query";
import { Download, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { saveFile } from "../forms/forms.api.js";
import { formatDate } from "../i18n/formatting.js";
import { t } from "../i18n/strings.js";
import {
  type ChosenRecord,
  erasePerson,
  exportPerson,
  findPerson,
  type FoundKind,
  type Person,
  type PersonSearch,
} from "./privacy.api.js";
import { privacyKeys } from "./privacy.queries.js";

type Mode = "email" | "name";

/**
 * Find a person: one field (their email, or their full name instead), then what was found,
 * kind by kind, with the two things people ask for: a copy of it, and to have it erased.
 * Erasing asks first, listing what happens to each kind. Two people can share a name, so after
 * a name search each record has a tick box, and only the ones ticked are exported or erased.
 */
export function FindPerson() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("email");
  const [typed, setTyped] = useState("");
  const [searched, setSearched] = useState<{ person: Person; result: PersonSearch } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [explanations, setExplanations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<"find" | "export" | "erase" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [ticked, setTicked] = useState<ChosenRecord[]>([]);

  const person: Person = mode === "email" ? { email: typed, name: "" } : { email: "", name: typed };

  async function run(kind: "find" | "export" | "erase", task: () => Promise<void>) {
    setError(null);
    setStatus(null);
    setExplanations([]);
    setWorking(kind);
    try {
      await task();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setWorking(null);
    }
  }

  const find = () =>
    run("find", async () => {
      setSearched({ person, result: await findPerson(person) });
      setTicked([]);
    });

  const download = (who: Person) =>
    run("export", async () => {
      const { blob, filename } = await exportPerson(who, byName(who) ? ticked : undefined);
      saveFile(blob, filename);
      setStatus(t("privacy.find.exported"));
      await queryClient.invalidateQueries({ queryKey: privacyKeys.requests() });
    });

  const erase = (who: Person) =>
    run("erase", async () => {
      // Closed either way, so a failure's message can be read behind it.
      setConfirming(false);
      const outcome = await erasePerson(who, byName(who) ? ticked : undefined);
      setSearched({ person: who, result: await findPerson(who) });
      setTicked([]);
      setStatus(t("privacy.find.erased"));
      setExplanations(outcome.explanations);
      await queryClient.invalidateQueries({ queryKey: privacyKeys.requests() });
    });

  const total = searched?.result.found.reduce((sum, kind) => sum + kind.items.length, 0) ?? 0;
  const choosing = searched !== null && byName(searched.person);
  const kindsAffected =
    searched?.result.found.filter(
      (kind) => !choosing || ticked.some((record) => record.kindId === kind.kindId),
    ) ?? [];

  function toggle(record: ChosenRecord) {
    setTicked((current) =>
      current.some((one) => sameRecord(one, record))
        ? current.filter((one) => !sameRecord(one, record))
        : [...current, record],
    );
  }

  return (
    <section aria-labelledby="find-person" className="flex flex-col gap-1.5">
      <h2 id="find-person" className="px-4 text-footnote font-medium text-label-secondary">
        {t("privacy.find.header")}
      </h2>
      <div className="flex flex-col gap-4 rounded-card bg-surface p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void find();
          }}
        >
          <div className="min-w-0 flex-1 basis-60">
            <TextField
              type={mode === "email" ? "email" : "text"}
              autoComplete="off"
              label={mode === "email" ? t("privacy.find.email") : t("privacy.find.name")}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="tinted"
            icon={<Search aria-hidden="true" />}
            disabled={working !== null || typed.trim() === ""}
          >
            {working === "find" ? t("privacy.find.searching") : t("privacy.find.submit")}
          </Button>
        </form>
        <button
          type="button"
          className="self-start text-footnote text-accent hover:underline"
          onClick={() => {
            setMode(mode === "email" ? "name" : "email");
            setTyped("");
          }}
        >
          {mode === "email" ? t("privacy.find.byName") : t("privacy.find.byEmail")}
        </button>
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
        <div role="status" className="flex flex-col gap-4">
          {status && <p className="text-footnote text-success">{status}</p>}
          {explanations.length > 0 && (
            <ul className="flex flex-col gap-1 text-footnote text-label-secondary">
              {explanations.map((explanation) => (
                <li key={explanation}>{explanation}</li>
              ))}
            </ul>
          )}
          {searched && (
            <SearchResult
              result={searched.result}
              total={total}
              working={working}
              ticked={choosing ? ticked : null}
              onToggle={toggle}
              onDownload={() => void download(searched.person)}
              onErase={() => setConfirming(true)}
            />
          )}
        </div>
      </div>
      <p className="px-4 text-footnote text-label-secondary">{t("privacy.find.footer")}</p>
      {searched && (
        <Dialog
          open={confirming}
          onClose={() => setConfirming(false)}
          size="alert"
          title={t("privacy.find.eraseTitle")}
          description={t("privacy.find.eraseMessage")}
          footer={
            <>
              <Button
                variant="tinted"
                onClick={() => setConfirming(false)}
                disabled={working !== null}
                data-autofocus
              >
                {t("privacy.find.cancel")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => void erase(searched.person)}
                disabled={working !== null}
              >
                {t("privacy.find.eraseConfirm")}
              </Button>
            </>
          }
        >
          {choosing && (
            <p className="mb-3 text-footnote text-warning">
              {t("privacy.find.tickedCount", { count: ticked.length })}
            </p>
          )}
          <ul className="flex flex-col gap-2 text-footnote">
            {kindsAffected.map((kind) => (
              <li key={kind.kindId}>
                <span className="font-medium text-label">{kind.name}</span>
                <span className="text-label-secondary"> · {kind.erasure}</span>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
    </section>
  );
}

const byName = (person: Person) => person.email.trim() === "";

const sameRecord = (first: ChosenRecord, second: ChosenRecord) =>
  first.kindId === second.kindId && first.id === second.id;

function SearchResult({
  result,
  total,
  working,
  ticked,
  onToggle,
  onDownload,
  onErase,
}: {
  result: PersonSearch;
  total: number;
  working: string | null;
  /** Null after a search by email, which is one person already. */
  ticked: ChosenRecord[] | null;
  onToggle: (record: ChosenRecord) => void;
  onDownload: () => void;
  onErase: () => void;
}) {
  const nothingTicked = ticked !== null && ticked.length === 0;
  return (
    <>
      <p className="text-body text-label">
        {total === 0 ? t("privacy.find.nothing") : t("privacy.find.foundCount", { count: total })}
      </p>
      {ticked !== null && total > 0 && (
        <p className="text-footnote text-label-secondary">{t("privacy.find.tickHint")}</p>
      )}
      {result.found.length > 0 && (
        <ul className="flex flex-col divide-y divide-separator rounded-control bg-fill/40">
          {result.found.map((kind) => (
            <FoundKindRow key={kind.kindId} kind={kind} ticked={ticked} onToggle={onToggle} />
          ))}
        </ul>
      )}
      {result.notSearched.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="text-footnote font-medium text-label-secondary">
            {t("privacy.find.notSearchedHeader")}
          </h3>
          {result.notSearched.map((kind) => (
            <p key={kind.kindId} className="text-footnote text-label-secondary">
              <span className="font-medium text-label">{kind.name}</span> · {kind.reason}
            </p>
          ))}
        </div>
      )}
      {total > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="tinted"
            icon={<Download aria-hidden="true" />}
            onClick={onDownload}
            disabled={working !== null || nothingTicked}
          >
            {working === "export" ? t("privacy.find.exporting") : t("privacy.find.export")}
          </Button>
          <Button
            variant="destructive"
            icon={<Trash2 aria-hidden="true" />}
            onClick={onErase}
            disabled={working !== null || nothingTicked}
          >
            {t("privacy.find.erase")}
          </Button>
        </div>
      )}
    </>
  );
}

/** One kind of data: its name and count, opening to the items themselves. */
function FoundKindRow({
  kind,
  ticked,
  onToggle,
}: {
  kind: FoundKind;
  ticked: ChosenRecord[] | null;
  onToggle: (record: ChosenRecord) => void;
}) {
  return (
    <li>
      <details className="group px-3 py-2.5" open={ticked !== null}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-body text-label">
          <span>{kind.name}</span>
          <span className="text-footnote text-label-secondary">{kind.items.length}</span>
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-footnote text-label-secondary">
          {kind.items.map((item) => {
            const words = [
              item.summary,
              ...(ticked ? [item.email || t("privacy.find.noEmail")] : []),
              ...(item.date ? [formatDate(item.date)] : []),
            ].join(" · ");
            const record = { kindId: kind.kindId, id: item.id };
            return (
              <li key={item.id}>
                {ticked ? (
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ticked.some((one) => sameRecord(one, record))}
                      onChange={() => onToggle(record)}
                    />
                    <span className="min-w-0 break-words">{words}</span>
                  </label>
                ) : (
                  words
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}
