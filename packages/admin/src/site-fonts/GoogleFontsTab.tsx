import { fontCatalogue } from "@lintel/builder-model";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { describeFontError } from "./describeFontError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { SelectField } from "../design/SelectField.js";
import { TextField } from "../design/TextField.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { categoryName, fallbackFor, fontCategories, weightName } from "./fontLabels.js";
import {
  type FontCategory,
  type GoogleFont,
  googlePreviewUrl,
  searchGoogleFonts,
  type SiteFonts,
} from "./siteFonts.api.js";
import { useAddGoogleFont, useFontPreview } from "./siteFonts.queries.js";

const includedFamilies = new Set(fontCatalogue.map((font) => font.family));

/** Search the whole Google Fonts library, preview a family, pick its weights and add it. */
export function GoogleFontsTab({
  siteFonts,
  onAdded,
}: {
  siteFonts: SiteFonts | undefined;
  onAdded: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<FontCategory | "">("");
  const [chosen, setChosen] = useState<GoogleFont | null>(null);
  // Searching waits for a pause in typing, so each letter isn't a search of its own.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), 250);
    return () => clearTimeout(timer);
  }, [typed]);
  const results = useQuery({
    queryKey: ["site-fonts", "google", search, category],
    queryFn: () => searchGoogleFonts(search, category),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const onSite = new Set(siteFonts?.fonts.map((font) => font.family) ?? []);

  if (chosen) {
    return <ChosenFont font={chosen} onBack={() => setChosen(null)} onAdded={onAdded} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div role="search" className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <TextField
            data-autofocus
            type="search"
            label={t("siteFonts.google.search")}
            placeholder={t("siteFonts.google.placeholder")}
            value={typed}
            maxLength={80}
            onChange={(event) => setTyped(event.target.value)}
            className="[&_input]:ps-9"
          />
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 inset-s-3 size-4 text-label-tertiary"
          />
        </div>
        <SelectField
          label={t("siteFonts.google.category")}
          value={category}
          onValueChange={(value) => setCategory(value as FontCategory | "")}
          options={[
            { value: "", label: t("siteFonts.google.anyCategory") },
            ...fontCategories.map((value) => ({ value, label: categoryName(value) })),
          ]}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {results.isError ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-card bg-surface p-4 text-footnote text-label"
          >
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            {describeFontError(results.error)}
          </p>
        ) : results.isPending ? (
          <p role="status" className="p-4 text-footnote text-label-secondary">
            {t("siteFonts.google.searching")}
          </p>
        ) : results.data.fonts.length === 0 ? (
          <p className="p-4 text-footnote text-label-secondary">
            {t("siteFonts.google.none", { search })}
          </p>
        ) : (
          <>
            <ul
              aria-label={search ? t("siteFonts.google.results") : t("siteFonts.google.popular")}
              className="overflow-hidden rounded-card bg-surface"
            >
              {results.data.fonts.map((font) => (
                <GoogleFontRow
                  key={font.id}
                  font={font}
                  note={
                    onSite.has(font.family)
                      ? t("siteFonts.google.onSite")
                      : includedFamilies.has(font.family)
                        ? t("siteFonts.google.included")
                        : undefined
                  }
                  onChoose={() => setChosen(font)}
                />
              ))}
            </ul>
            {results.data.total > results.data.fonts.length && (
              <p className="px-4 pt-2 text-footnote text-label-secondary">
                {t("siteFonts.google.more", {
                  shown: results.data.fonts.length,
                  total: results.data.total,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function GoogleFontRow({
  font,
  note,
  onChoose,
}: {
  font: GoogleFont;
  note: string | undefined;
  onChoose: () => void;
}) {
  const preview = useFontPreview(googlePreviewUrl(font.id), true);
  return (
    <li className="not-last:hairline-bottom">
      <button
        type="button"
        onClick={onChoose}
        className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-fill focus-visible:focus-ring-inset"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className="truncate text-title-3 text-label"
            style={{
              fontFamily: preview ? `"${preview}", ${fallbackFor[font.category]}` : undefined,
            }}
          >
            {font.family}
          </span>
          <span className="truncate text-footnote text-label-secondary">
            {categoryName(font.category)} ·{" "}
            {font.weights.length === 1
              ? weightName(font.weights[0] ?? "400")
              : t("siteFonts.google.weightCount", { count: font.weights.length })}
          </span>
        </span>
        {note && <span className="shrink-0 text-footnote text-label-secondary">{note}</span>}
      </button>
    </li>
  );
}

/** The weights the font is added with, to start: regular and bold, where it has them. */
function startingWeights(font: GoogleFont): string[] {
  const wanted = font.weights.filter((weight) => weight === "400" || weight === "700");
  return wanted.length > 0 ? wanted : font.weights.slice(0, 1);
}

function ChosenFont({
  font,
  onBack,
  onAdded,
}: {
  font: GoogleFont;
  onBack: () => void;
  onAdded: () => void;
}) {
  const [weights, setWeights] = useState(startingWeights(font));
  const [italic, setItalic] = useState(false);
  const add = useAddGoogleFont();
  const toast = useToast();
  const preview = useFontPreview(googlePreviewUrl(font.id), true);

  const toggle = (weight: string) =>
    setWeights((current) =>
      current.includes(weight)
        ? current.filter((each) => each !== weight)
        : [...current, weight].sort(),
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start rounded-control text-footnote font-medium text-accent hover:underline focus-visible:focus-ring"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
        {t("siteFonts.google.back")}
      </button>
      <p
        className="text-large-title break-words text-label"
        style={{ fontFamily: preview ? `"${preview}", ${fallbackFor[font.category]}` : undefined }}
      >
        {font.family}
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-footnote font-medium text-label">
          {t("siteFonts.google.weights")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {font.weights.map((weight) => {
            const checked = weights.includes(weight);
            return (
              <label
                key={weight}
                className={classNames(
                  "flex h-9 cursor-pointer items-center gap-2 rounded-full px-3 text-footnote has-[:focus-visible]:focus-ring",
                  checked ? "bg-accent/12 text-accent" : "bg-fill text-label",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(weight)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {weightName(weight)}
              </label>
            );
          })}
        </div>
      </fieldset>
      {font.hasItalic && (
        <label className="flex items-center gap-2 text-body text-label">
          <input
            type="checkbox"
            checked={italic}
            onChange={(event) => setItalic(event.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("siteFonts.google.italic")}
        </label>
      )}
      <p className="text-footnote text-label-secondary">{t("siteFonts.google.privacy")}</p>
      {add.isError && (
        <p role="alert" className="text-footnote text-danger">
          {describeFontError(add.error)}
        </p>
      )}
      <div className="mt-auto flex justify-end">
        <Button
          disabled={weights.length === 0 || add.isPending}
          onClick={() =>
            add.mutate(
              { id: font.id, weights, italic },
              {
                onSuccess: () => {
                  toast({
                    message: t("siteFonts.google.added", { family: font.family }),
                    tone: "neutral",
                  });
                  onAdded();
                },
              },
            )
          }
        >
          {add.isPending
            ? t("siteFonts.google.adding")
            : t("siteFonts.google.addFamily", { family: font.family })}
        </Button>
      </div>
    </div>
  );
}
