# GraphQL

The GraphQL delivery API at `/graphql`, served with GraphQL Yoga (see
`docs/decisions/0009-graphql-with-yoga.md`). It is built from the blueprints, so each
collection gets typed queries and its fields keep the handles they have in the REST API:

```graphql
{
  pages(page: 1, perPage: 10) {
    total
    items {
      slug
      url
      data {
        title
        hero_image {
          url(width: 800, format: webp)
          alt
        }
        body {
          html
        }
      }
    }
  }
  pagesEntry(slug: "about") {
    data {
      title
    }
    seo {
      title
      description
    }
  }
  asset(id: "...") {
    url
  }
  collections {
    handle
    name
  }
}
```

- **Names.** `blog_posts` gives `blogPosts` (a page of entries) and `blogPostsEntry(slug:)`
  (one entry, or null); types are `BlogPostsEntry` and, for the blueprint's fields,
  `BlogPostFields`. A collection called `assets` or `collections` gets `Entries` added.
- **Field types.** Text, long text and dates are `String`; numbers `Float`; toggles
  `Boolean`; choices `String` or `[String!]`; images `Asset` (with `url(width, height,
fit, format)`); rich text `RichText { html json }`; links `Link { url label }`.
- **Published only, unless previewing.** Queries read what delivery reads. `preview: true`
  reads the latest saved values, drafts included; it needs a read-write API token or an
  admin session with `entries:read`. The media library can be listed (`assets`) only with
  a token or session; one asset by id is public, like its file.
- **Access** follows the delivery API's rules (`requireDeliveryAccess`), CORS included.
- **Following changes.** The schema is built from the collections and blueprints and kept
  until one of them changes, so a new field shows up on the next request.
- **SEO.** With the SEO plugin on, entries have `seo` and the root has `redirects`.

## Limits

`graphql-limits.ts` checks every query before it runs: at most 10 levels deep, and a cost
of at most 5000, where each value costs 1, each object 2, and everything under a list
counts once per item it could return (`perPage`, or 100 when it comes from a variable).
`perPage` itself is 1 to 100. Introspection is left out of both, so GraphiQL and code
generators work. GraphiQL is served at `/graphql` in development only.

## Files

| File                      | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `graphql.routes.ts`       | Yoga on `/graphql`, access, caching the schema      |
| `graphql-schema.ts`       | Building the schema from the content model          |
| `graphql-shared-types.ts` | Asset, RichText, Link and the other fixed types     |
| `graphql-names.ts`        | GraphQL names from handles                          |
| `graphql-limits.ts`       | The depth and cost rules                            |
| `graphql.service.ts`      | What the resolvers return, and who may preview      |
| `graphql.repository.ts`   | The content model and the working copies of entries |
