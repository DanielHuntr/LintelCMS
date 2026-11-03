import { Card, EmptyState, LoadError, LoadingRegion, Skeleton } from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { Camera, Play } from "lucide-react";
import { useState } from "react";
import type { AdminInstagramPost } from "../server/instagram.schema.js";
import { AltTextDialog } from "./AltTextDialog.js";
import { listPosts, postsKey } from "./instagram.api.js";
import { t } from "./strings.js";

/** The copied posts, as the website shows them. Choosing one opens its description. */
export function PostGrid({ canDescribe }: { canDescribe: boolean }) {
  const posts = useQuery({ queryKey: postsKey, queryFn: listPosts });
  const [chosen, setChosen] = useState<AdminInstagramPost | null>(null);

  return (
    <Card title={t("posts.title")}>
      {posts.isError && <LoadError error={posts.error} onRetry={() => void posts.refetch()} />}
      {posts.isPending && (
        <LoadingRegion label={t("instagram.loading")}>
          <Skeleton className="h-48" />
        </LoadingRegion>
      )}
      {posts.data?.length === 0 && (
        <EmptyState
          icon={Camera}
          title={t("posts.empty")}
          description={t("posts.emptyDescription")}
        />
      )}
      {posts.data && posts.data.length > 0 && (
        <>
          <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
            {posts.data.map((post) => (
              <li key={post.id} className="relative">
                <button
                  type="button"
                  disabled={!canDescribe}
                  onClick={() => setChosen(post)}
                  aria-label={t("posts.describe", { caption: post.altText || post.caption })}
                  className="block aspect-square w-full overflow-hidden rounded-control bg-fill focus-visible:focus-ring"
                >
                  <img
                    src={post.image}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
                {post.mediaType === "VIDEO" && (
                  <Play
                    aria-label={t("posts.video")}
                    className="pointer-events-none absolute top-1.5 inset-e-1.5 size-4 text-white"
                  />
                )}
              </li>
            ))}
          </ul>
          {canDescribe && (
            <p className="mt-3 text-footnote text-label-secondary">{t("posts.footer")}</p>
          )}
        </>
      )}
      <AltTextDialog post={chosen} onClose={() => setChosen(null)} />
    </Card>
  );
}
