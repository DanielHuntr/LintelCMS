import { apiRequest } from "@lintel/admin/plugin";
import type { AdminInstagramPost, InstagramAccountSummary } from "../server/instagram.schema.js";

/** Calls to the add-on's own routes (see src/server/instagram.routes.ts). */

export const accountKey = ["instagram", "account"] as const;
export const postsKey = ["instagram", "posts"] as const;

export const readAccount = () => apiRequest<InstagramAccountSummary>("/instagram/account");

export const connectAccount = (accessToken: string) =>
  apiRequest<InstagramAccountSummary>("/instagram/account", {
    method: "PUT",
    body: { accessToken },
  });

export const disconnectAccount = () => apiRequest<void>("/instagram/account", { method: "DELETE" });

export const syncNow = () =>
  apiRequest<InstagramAccountSummary>("/instagram/sync", { method: "POST" });

export async function listPosts(): Promise<AdminInstagramPost[]> {
  return (await apiRequest<{ posts: AdminInstagramPost[] }>("/instagram/posts")).posts;
}

export const saveAltText = (postId: string, altText: string) =>
  apiRequest<void>(`/instagram/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    body: { altText },
  });
