---
title: Releases and the update feed
description: Publishing a release Lintel's updater accepts, the feed format, and the signing key.
since: "1.0"
sidebar:
  label: Releases and updates
---

Lintel's admin tells people about new versions and installs them (see
[Updating Lintel](/using/updating/)). This page is for whoever publishes releases, and for
agencies who run their own update feed. Why it works this way is in
`docs/decisions/0018-updates-from-the-admin.md`; the code is in
`packages/core/src/updates`.

## Versions

Every package (`package.json` at the root, in `packages/*` and `starters/*`) carries the
same version, a [semantic version](https://semver.org): `1.2.0`, or `1.2.0-rc.1` and
`1.2.0-beta.1` for test versions. `lintel --version` and Settings → About show it. The
git tag for a release is the version with a `v`: `v1.2.0`.

Pre-release versions (with a `-`) are on the **beta** channel; the rest are **stable**.
People choose "Stable" or "Betas too" in Settings → Updates. Someone already running a
pre-release is also shown newer pre-releases on "Stable".

## The feed

By default Lintel reads `https://api.github.com/repos/DanielHuntr/LintelCMS/releases`
once a day: one GET, with `User-Agent: Lintel` and nothing else about the site. Drafts and
tags that aren't versions are skipped. From each release it takes:

| Field           | From                                                                                 |
| --------------- | ------------------------------------------------------------------------------------ |
| version         | the tag (`v1.2.0` → `1.2.0`)                                                         |
| channel         | beta when GitHub's **Set as a pre-release** is ticked, or the version has a `-`      |
| notes           | the release's description, Markdown, shown as HTML (raw HTML shows as text)          |
| security        | a `Security: yes` line, a `## Security` heading, or "security" in the release's name |
| breaking        | a `Breaking: yes` line, or a `## Breaking changes` heading                           |
| minimum version | a `Minimum version: 1.1.0` line: older sites must take that update first             |

The `Security:`, `Breaking:` and `Minimum version:` lines are taken out of the notes people
read. Write the first paragraph of the notes for site owners: it is the summary on
Settings → Updates and in the security email.

### Your own feed

Set `UPDATE_FEED_URL` to a GitHub releases address of your own, or to a JSON file in
Lintel's format:

```json
{
  "releases": [
    {
      "version": "1.2.0",
      "name": "Lintel 1.2.0",
      "channel": "stable",
      "publishedAt": "2026-11-01T09:00:00Z",
      "notes": "Faster uploads, and a fix for a sign-in problem.",
      "security": true,
      "breaking": false,
      "minimumVersion": null,
      "pageUrl": "https://updates.example.com/1.2.0",
      "assets": [
        {
          "name": "lintel-1.2.0-linux-x64.tar.gz",
          "url": "https://updates.example.com/lintel-1.2.0-linux-x64.tar.gz"
        },
        { "name": "SHA256SUMS", "url": "https://updates.example.com/SHA256SUMS" },
        { "name": "SHA256SUMS.minisig", "url": "https://updates.example.com/SHA256SUMS.minisig" }
      ]
    }
  ]
}
```

Builds signed with your own key need `UPDATE_PUBLIC_KEY` set to your public key.
`UPDATE_CHECKS=off` stops checks altogether.

## What a release must carry

The Update button (installs started with `lintel start`) only installs a release with
these files attached:

| File                                        | What it is                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `lintel-<version>-<platform>-<arch>.tar.gz` | The built Lintel for one kind of server, such as `linux-x64` or `linux-arm64` (Node's `process.platform` and `process.arch`) |
| `SHA256SUMS`                                | `<sha-256>  <file name>` for every build, as `sha256sum` writes it                                                           |
| `SHA256SUMS.minisig`                        | A [minisign](https://jedisct1.github.io/minisign/) signature of `SHA256SUMS`                                                 |

Lintel downloads the build for its own platform, checks the signature against the public
key built into it (`packages/core/src/updates/release-public-key.ts`), checks the build's
SHA-256 against `SHA256SUMS`, and only then unpacks it. A release without a build for a
platform simply can't be installed there with the button; Settings → Updates says so.

A build unpacks to a release folder:

```text
release.json        { "version": "1.2.0", "start": "packages/core/dist/main.js", ... }
lintel.mjs          node lintel.mjs start: the supervisor
package.json
packages/core/      dist, migrations and production node_modules
packages/cli/       dist and production node_modules
packages/admin/dist
```

## Publishing a release

Nothing here publishes on its own: you build and sign on your computer, then attach the
files to the GitHub release yourself.

1. Set the new version in every `package.json` (they must all agree), update the release
   notes, and commit.
2. Build, pack, checksum and sign, on each platform you publish a build for, into the
   same folder:

   ```bash
   node scripts/release/build-release.mjs --key ~/lintel-release-key/lintel-release.key
   ```

   It runs `pnpm install` and the build, gathers what runs (as the Docker image does),
   writes `release-files/lintel-<version>-<platform>-<arch>.tar.gz`, then rewrites
   `SHA256SUMS` for every build in the folder and signs it again.

3. Tag the commit `v<version>` and push the tag.
4. Create the GitHub release for the tag, write the notes (with any `Security: yes`,
   `Breaking: yes` or `Minimum version:` lines), tick **Set as a pre-release** for a beta,
   and attach everything in `release-files/`.

Sites see it within a day, or straight away with **Check now**.

## The signing key

```bash
node scripts/release/generate-signing-key.mjs ~/lintel-release-key
```

writes `lintel-release.key` (private: keep it out of the repository, backed up and
secret) and `lintel-release.pub`, and prints the public key line. Put that line in
`release-public-key.ts`. The key is Ed25519 in minisign's format, so `minisign -Vm
SHA256SUMS -P <public key>` checks a signature by hand, and a key made with `minisign -G`
works too (sign with `minisign -S -m SHA256SUMS`).

Changing the key: versions built with the old key only accept releases signed with it. Sign
one release with the old key whose build contains the new public key; every later release
is signed with the new one.

## Docker and source installs

The Docker image doesn't use the builds: Settings → Updates shows
`git fetch --tags && git checkout v<version>` and `docker compose ... up -d --build`, or
asks the opt-in lintel-updater service to run them. Git clones use `pnpm lintel update`,
which checks out the release tag (or follows the branch when there are no tags), so for
those the git tag is what matters.
