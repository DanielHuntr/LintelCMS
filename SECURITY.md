# Security policy

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately instead,
through GitHub's **Report a vulnerability** button on this repository's Security tab
(private vulnerability reporting).

Tell us what you found, the version or commit, and how to reproduce it. A proof of concept
helps, but isn't required. You'll get an answer within three working days, and we'll keep
you told as we fix it. Once a fix is released we're glad to credit you, unless you'd rather
stay anonymous.

Please give us a reasonable time to release a fix (90 days at most) before you publish
details, and don't test against sites you don't own, read other people's data, or degrade a
service while looking.

## Supported versions

Lintel hasn't had a stable release yet. Until 1.0, only the latest commit on `main` gets
security fixes; upgrade to it to get them. From 1.0, the latest minor release of the current
major version will be supported, and the previous major version for six months after a new
one comes out.

## What counts

Anything that lets someone do what their role, token or preview link shouldn't allow:
reading drafts or settings, changing content, signing in as someone else, running script in
the admin, reaching the server's private network, or knocking a server over with a few
requests. How Lintel defends itself, and what it trusts, is in
[docs/security/threat-model.md](docs/security/threat-model.md).

Not in scope: problems that need shell or database access to the server, plugins you wrote
yourself, and missing hardening that the threat model already lists as a known risk
(though suggestions are welcome as ordinary issues).
