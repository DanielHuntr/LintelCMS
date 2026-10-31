import type { SetupCode } from "./setup.api.js";

/**
 * The terminal shows the code as 8 digits in two groups, like 4821-0937. The API ignores
 * spaces and dashes; the admin sends the digits alone, however they were typed or pasted.
 */
export const setupCodeLength = 8;
export const setupCodeGroupLength = 4;

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
