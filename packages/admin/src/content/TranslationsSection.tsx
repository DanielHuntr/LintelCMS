import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Languages, Plus } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";
import { useLocales } from "../locales/locales.queries.js";
import { useCan } from "../session/SessionContext.js";
import { translateEntry } from "./content.api.js";
import { contentKeys } from "./content.queries.js";
import type { Entry } from "./content.types.js";
import { EntryStatusBadge } from "./EntryStatusBadge.js";
import { PanelSection } from "./PanelSection.js";

interface TranslationsSectionProps {
  collectionHandle: string;
  /** Undefined for a new entry, which has to be saved before it can be translated. */
  entry: Entry | undefined;
  /** The entry's language. Undefined is the site's main language. */
  locale: string | undefined;
}

/**
 * The language switcher: which language this entry is in, and the same entry in the site's
 * other languages, to open or to start translating. Hidden on sites with one language.
 */
export function TranslationsSection({ collectionHandle, entry, locale }: TranslationsSectionProps) {
  const locales = useLocales();
  const canTranslate = useCan("entries:create");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [translatingInto, setTranslatingInto] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const siteLocales = locales.data?.locales ?? [];
  if (!locales.data || siteLocales.length < 2) return null;
  const current = locale ?? locales.data.defaultLocale;
  const nameOf = (code: string) =>
    siteLocales.find((candidate) => candidate.code === code)?.name ?? code;
  const others = siteLocales.filter((candidate) => candidate.code !== current);

  async function translate(code: string) {
    if (!entry) return;
    setTranslatingInto(code);
    setProblem(null);
    try {
      const translation = await translateEntry(entry.id, code);
      queryClient.setQueryData(contentKeys.entry(translation.id), translation);
      void queryClient.invalidateQueries({ queryKey: contentKeys.entry(entry.id) });
      void queryClient.invalidateQueries({ queryKey: contentKeys.collections() });
      await navigate({
        to: "/content/$collection/$entryId",
        params: { collection: collectionHandle, entryId: translation.id },
      });
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setTranslatingInto(null);
    }
  }

  return (
    <PanelSection title={t("translations.title")} value={nameOf(current)}>
      <p className="flex items-center gap-2 text-body text-label">
        <Languages aria-hidden="true" strokeWidth={1.75} className="size-4 text-label-secondary" />
        {t("translations.writtenIn", { language: nameOf(current) })}
      </p>
      <ul className="-mx-2 flex flex-col">
        {others.map((other) => {
          const translation = entry?.translations.find((member) => member.locale === other.code);
          if (translation) {
            return (
              <li key={other.code}>
                <Link
                  to="/content/$collection/$entryId"
                  params={{ collection: collectionHandle, entryId: translation.id }}
                  aria-label={t("translations.open", { language: other.name })}
                  className="flex items-center gap-2 rounded-control px-2 py-1.5 text-footnote text-label hover:bg-fill focus-visible:focus-ring"
                >
                  <span className="min-w-0 flex-1 truncate">{other.name}</span>
                  <EntryStatusBadge status={translation.status} />
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={2}
                    className="size-3.5 text-label-tertiary"
                  />
                </Link>
              </li>
            );
          }
          return (
            <li key={other.code} className="flex items-center gap-2 px-2 py-1">
              <span className="min-w-0 flex-1 truncate text-footnote text-label-secondary">
                {other.name}
              </span>
              {canTranslate && entry && (
                <Button
                  variant="plain"
                  size="small"
                  icon={<Plus aria-hidden="true" />}
                  aria-label={t("translations.translateInto", { language: other.name })}
                  disabled={translatingInto !== null}
                  onClick={() => void translate(other.code)}
                >
                  {t("translations.translate")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {!entry && (
        <p className="text-footnote text-label-secondary">{t("translations.saveFirst")}</p>
      )}
      {problem && (
        <p role="alert" className="text-footnote text-danger">
          {problem}
        </p>
      )}
    </PanelSection>
  );
}
