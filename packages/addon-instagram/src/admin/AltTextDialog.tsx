import { Button, describeError, Dialog, TextField } from "@lintel/admin/plugin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import type { AdminInstagramPost } from "../server/instagram.schema.js";
import { postsKey, saveAltText } from "./instagram.api.js";
import { t } from "./strings.js";

/** Describing one post's picture, for people who use a screen reader. */
export function AltTextDialog({
  post,
  onClose,
}: {
  post: AdminInstagramPost | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [altText, setAltText] = useState("");
  useEffect(() => setAltText(post?.altText ?? ""), [post]);

  const save = useMutation({
    mutationFn: (text: string) => saveAltText(post?.id ?? "", text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: postsKey });
      onClose();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(altText.trim());
  };

  return (
    <Dialog
      open={post !== null}
      onClose={onClose}
      title={t("alt.title")}
      description={t("alt.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("alt.cancel")}
          </Button>
          <Button type="submit" form="instagram-alt-text" disabled={save.isPending}>
            {save.isPending ? t("alt.saving") : t("alt.save")}
          </Button>
        </>
      }
    >
      {post && (
        <form id="instagram-alt-text" className="flex flex-col gap-4" onSubmit={submit}>
          <img
            src={post.image}
            alt=""
            className="aspect-square w-40 rounded-control bg-fill object-cover"
          />
          <TextField
            label={t("alt.label")}
            value={altText}
            maxLength={300}
            placeholder={t("alt.placeholder")}
            onChange={(event) => setAltText(event.target.value)}
            error={save.isError ? describeError(save.error) : undefined}
            data-autofocus
          />
          {post.caption && (
            <div className="text-footnote text-label-secondary">
              <p className="font-medium">{t("alt.caption")}</p>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-line">{post.caption}</p>
            </div>
          )}
          <a
            href={post.permalink}
            target="_blank"
            rel="noreferrer"
            className="text-footnote text-accent"
          >
            {t("alt.openOnInstagram")}
          </a>
        </form>
      )}
    </Dialog>
  );
}
