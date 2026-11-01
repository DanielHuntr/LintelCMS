# Security

The admin's Content-Security-Policy and the headers to serve it with
(`contentSecurityPolicy.ts`). `vite.config.ts` writes the policy into the built
`index.html` as a `<meta>` tag and sends the full headers from `pnpm preview`. Development
(`pnpm dev`) is left without it, because Vite's hot reload runs inline scripts.

When you host the built admin yourself, send the headers from `securityHeaders()` with every
file (and `Strict-Transport-Security` once it is on HTTPS): `frame-ancestors` only works as
a header. See `docs/security/threat-model.md`.
