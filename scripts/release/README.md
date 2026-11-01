# Release scripts

Making a release the updater accepts. Nothing here uploads or publishes: you attach the
files to the GitHub release yourself. The whole process, for people who publish releases,
is the docs page "Releases and the update feed"
(`packages/docs/src/content/docs/building/releases.md`).

| Script                     | What it does                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| `generate-signing-key.mjs` | Makes a release key pair; prints the public key for `release-public-key.ts`              |
| `build-release.mjs`        | Builds, packs `lintel-<version>-<platform>-<arch>.tar.gz`, writes and signs `SHA256SUMS` |

```bash
node scripts/release/generate-signing-key.mjs ~/lintel-release-key     # once
node scripts/release/build-release.mjs --key ~/lintel-release-key/lintel-release.key
```

The private key never goes in the repository. Keep it backed up somewhere safe: without it
no new release can be installed with the Update button.
