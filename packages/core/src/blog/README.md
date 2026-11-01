# Blog

The "Blog" plugin (`blog`). It has no tables or routes of its own: switching it on runs
`ensureBlogPostsCollection` (see `src/collections/default-collections.ts`), which makes the
**Blog posts** collection (`posts`) with the **Categories** and **Tags** taxonomies if they
are missing. Switching it off leaves every post where it is.

| File             | What it does                    |
| ---------------- | ------------------------------- |
| `blog.plugin.ts` | The plugin's `definePlugin({})` |
