import { type DeploymentBranding, readDeploymentBranding } from "./branding/deployment-branding.js";
import { readDeploymentInterfaceLanguage } from "./interface-languages/deployment-interface-language.js";
import { readLintelConfigFile } from "./lintel-config-file.js";

/**
 * What an agency bakes into every copy it deploys (lintel.config.json and LINTEL_BRAND_*):
 * its branding and the admin's language. Read once at start, in development and production.
 */
export function readDeploymentOptions(): {
  branding: DeploymentBranding;
  defaultInterfaceLanguage: string;
} {
  const configFile = readLintelConfigFile();
  return {
    branding: readDeploymentBranding(configFile),
    defaultInterfaceLanguage: readDeploymentInterfaceLanguage(configFile),
  };
}
