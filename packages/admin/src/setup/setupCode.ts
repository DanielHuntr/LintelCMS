import type { SetupCode } from "./setup.api.js";

/**
 * The setup code, kept in memory only (never in storage) so a later step, even on another
 * route, can send it again. A page reload forgets it, which is the safe way round.
 */
let rememberedCode: SetupCode;

export function rememberSetupCode(code: SetupCode) {
  rememberedCode = code;
}

export function rememberedSetupCode(): SetupCode {
  return rememberedCode;
}
