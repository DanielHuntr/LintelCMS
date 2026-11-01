import { ConfigFileError, type LintelConfigFile } from "../lintel-config-file.js";
import { canonicalLanguageTag, SOURCE_INTERFACE_LANGUAGE } from "./interface-languages.schema.js";

/**
 * The admin's language a server was deployed with: LINTEL_DEFAULT_INTERFACE_LANGUAGE, or
 * `interfaceLanguage` in lintel.config.json, or English. The site's own choice in Settings
 * wins over it.
 */
export function readDeploymentInterfaceLanguage(
  configFile: LintelConfigFile,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const chosen =
    environment.LINTEL_DEFAULT_INTERFACE_LANGUAGE || configFile.contents.interfaceLanguage;
  if (chosen === undefined || chosen === "") return SOURCE_INTERFACE_LANGUAGE;

  const canonical = typeof chosen === "string" ? canonicalLanguageTag(chosen) : null;
  if (!canonical) {
    throw new ConfigFileError(
      "the interface language setting",
      `"${String(chosen)}" isn't a language tag, such as en or fr-CA.`,
    );
  }
  return canonical;
}
