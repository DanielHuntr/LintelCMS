/**
 * The public half of Lintel's release signing key, in minisign's format. Every release's
 * SHA256SUMS file must be signed with the matching private key, which only the people who
 * publish releases have, or the updater refuses it (see release-signature.ts).
 *
 * Replacing the key: `node scripts/release/generate-signing-key.mjs <folder>` and paste the
 * line it prints here. Versions built with the old key only accept releases signed with it,
 * so publish one last release signed with the old key that contains the new one.
 *
 * Agencies who sign their own builds set UPDATE_PUBLIC_KEY instead of changing this file.
 */
export const LINTEL_RELEASE_PUBLIC_KEY = "RWQKh1qyURmhNaH3ePr1a9PMj5RkWOtVCLhllH93jnG5uQQbaClhNj/x";
