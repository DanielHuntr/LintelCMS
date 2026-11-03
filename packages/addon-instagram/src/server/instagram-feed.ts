import { defineBlock, escapeHtml, select, text, toggle } from "@lintel/core/plugin";
import type { PublicInstagramPost } from "./instagram.schema.js";

/**
 * How the feed looks on the website: a grid of the posts' pictures, each a plain link to the
 * post on Instagram. Pictures come from the site's own address, so nothing loads from
 * Instagram and the cookie notice needn't ask.
 */

export const FEED_COLUMNS = ["2", "3", "4"] as const;
const PUBLIC_POSTS_PATH = "/_lintel/api/addons/instagram/posts";

/** Plain layout, so the grid works on any site; the site's own styles can restyle it. */
const GRID_STYLE =
  "display:grid;gap:8px;grid-template-columns:repeat(var(--instagram-columns,3),minmax(0,1fr))";
const PICTURE_STYLE = "display:block;width:100%;aspect-ratio:1;object-fit:cover";

/**
 * The block's script: a block can't read the database as it is drawn, so the grid is filled
 * from the add-on's route for visitors once the page loads. Without scripts the plain link
 * to the profile stays. Written without braces doubled, which the template would read.
 */
const FILL_SCRIPT = `(function () {
  var script = document.currentScript;
  var feed = script && script.parentElement;
  if (!feed || !window.fetch) return;
  var grid = feed.querySelector(".instagram-feed__grid");
  fetch("${PUBLIC_POSTS_PATH}")
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (feedData) {
      if (!feedData || !feedData.posts || feedData.posts.length === 0) return;
      grid.textContent = "";
      feedData.posts.forEach(function (post) {
        var link = document.createElement("a");
        link.href = post.permalink;
        link.className = "instagram-feed__post";
        var picture = document.createElement("img");
        picture.src = post.image;
        picture.alt = post.alt;
        picture.loading = "lazy";
        picture.setAttribute("style", "${PICTURE_STYLE}");
        link.appendChild(picture);
        grid.appendChild(link);
      });
      var profile = feed.querySelector(".instagram-feed__profile a");
      if (profile && feedData.username) {
        profile.href = "https://www.instagram.com/" + encodeURIComponent(feedData.username) + "/";
        profile.textContent = "@" + feedData.username + " on Instagram";
        profile.parentElement.hidden = false;
      }
    })
    .catch(function () {});
})();`;

export const instagramFeedBlock = defineBlock({
  handle: "instagram_feed",
  name: "Instagram feed",
  icon: "camera",
  category: "Instagram",
  description: "Your latest Instagram posts in a grid, kept on your own server.",
  properties: {
    heading: text({ label: "Heading", default: "Follow along", maxLength: 80 }),
    columns: select({
      label: "Columns",
      default: "3",
      choices: FEED_COLUMNS.map((columns) => ({ value: columns, label: columns })),
    }),
    show_profile_link: toggle({ label: "Show a link to your profile", default: true }),
  },
  render: [
    '<section class="instagram-feed" style="--instagram-columns:{{columns}}">',
    '{{#heading}}<h2 class="instagram-feed__heading">{{heading}}</h2>{{/heading}}',
    `<div class="instagram-feed__grid" style="${GRID_STYLE}"><p style="grid-column:1/-1;margin:0">Our latest posts are on Instagram.</p></div>`,
    '{{#show_profile_link}}<p class="instagram-feed__profile" hidden><a href="https://www.instagram.com/"></a></p>{{/show_profile_link}}',
    `<script>${FILL_SCRIPT}</script>`,
    "</section>",
  ].join(""),
});

/** The grid drawn on the server, for `{% instagram_feed %}` in Liquid templates. */
export function renderFeedHtml(
  feed: { username: string | null; posts: readonly PublicInstagramPost[] },
  options: { columns: number; showProfileLink: boolean },
): string {
  if (feed.posts.length === 0) return "";
  const posts = feed.posts
    .map(
      (post) =>
        `<a class="instagram-feed__post" href="${escapeHtml(post.permalink)}"><img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.alt)}" loading="lazy" style="${PICTURE_STYLE}"></a>`,
    )
    .join("");
  const profile =
    options.showProfileLink && feed.username
      ? `<p class="instagram-feed__profile"><a href="https://www.instagram.com/${encodeURIComponent(feed.username)}/">@${escapeHtml(feed.username)} on Instagram</a></p>`
      : "";
  return `<section class="instagram-feed" style="--instagram-columns:${options.columns}"><div class="instagram-feed__grid" style="${GRID_STYLE}">${posts}</div>${profile}</section>`;
}

/** A whole number from a tag's option, kept between `lowest` and `highest`. */
export function readWholeNumber(
  value: unknown,
  fallback: number,
  lowest: number,
  highest: number,
): number {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(highest, Math.max(lowest, Math.round(number)));
}
