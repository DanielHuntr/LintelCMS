import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { contentKeys } from "../content/content.queries.js";
import type { CollectionStructure } from "../content/content.types.js";
import { entryUrlPreview } from "../content/slug.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { blueprintKeys } from "./blueprints.queries.js";
import {
  contentTypeHandle,
  createContentTypeBlueprint,
  createContentTypeCollection,
  routePatternFor,
} from "./createContentType.js";
import { StructureChoice } from "./StructureChoice.js";

/** /settings/content-types/new: name a kind of content, say how it's organised, then add fields. */
export function NewContentTypePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [structure, setStructure] = useState<CollectionStructure>("dated");
  const [nameError, setNameError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdBlueprintFor, setCreatedBlueprintFor] = useState<string | null>(null);

  const handle = contentTypeHandle(name);
  const examplePath = handle
    ? entryUrlPreview(routePatternFor(handle, structure), t("contentTypes.exampleSlug"))
    : null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!handle) {
      setNameError(t("builder.problem.name"));
      return;
    }
    setIsCreating(true);
    setError(null);
    try {
      // If the collection failed last time, the blueprint already exists: don't make it twice.
      if (createdBlueprintFor !== handle) {
        await createContentTypeBlueprint(name.trim());
        setCreatedBlueprintFor(handle);
      }
      const collection = await createContentTypeCollection(name.trim(), structure);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: blueprintKeys.blueprints() }),
        queryClient.invalidateQueries({ queryKey: contentKeys.collections() }),
      ]);
      await navigate({
        to: "/settings/content-types/$handle",
        params: { handle: collection.blueprintHandle },
      });
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.code === "INVALID_REQUEST" &&
        caught.fields?.handle
      ) {
        setNameError(caught.fields.handle);
      }
      setError(describeError(caught));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <BackLink to="/settings/content-types">{t("contentTypes.title")}</BackLink>
      <LargeTitle title={t("contentTypes.newTitle")} subtitle={t("contentTypes.newSubtitle")} />

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex flex-col gap-6"
        noValidate
      >
        {error && (
          <p role="alert" className="rounded-card bg-danger/10 px-4 py-3 text-footnote text-label">
            {error}
          </p>
        )}
        <section className="flex flex-col gap-6 rounded-card bg-surface p-5">
          <TextField
            label={t("contentTypes.name")}
            hint={t("contentTypes.nameHint")}
            placeholder={t("contentTypes.namePlaceholder")}
            value={name}
            error={nameError}
            autoFocus
            onChange={(event) => {
              setName(event.target.value);
              setNameError(undefined);
            }}
            className="max-w-md"
          />
          <StructureChoice value={structure} onChange={setStructure} />
          {examplePath && (
            <p className="text-footnote text-label-secondary">
              {t("contentTypes.addressPreview")}{" "}
              <span className="font-medium text-label">{examplePath}</span>
            </p>
          )}
        </section>
        <div className="flex justify-end gap-2">
          <LinkButton to="/settings/content-types" variant="plain">
            {t("common.cancel")}
          </LinkButton>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? t("contentTypes.creating") : t("contentTypes.create")}
          </Button>
        </div>
      </form>
    </>
  );
}
