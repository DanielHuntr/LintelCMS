# Preferences

What the builder remembers about the person using it, on their device: `skillLevel`,
`tourSeen` and `dismissedTips`. `browserPreferenceStore` keeps them in local storage
(prefixed `lintel.builder.`); `createMemoryPreferenceStore` is for tests. Hosts can pass
their own store to `PageBuilder` as `preferences`.
