/**
 * What the `lintel` command line tool (packages/cli) uses for `lintel start`, `lintel update`
 * and `lintel --version`. Imported as `@lintel/core/updates`.
 */
export { lintelVersion } from "./lintel-version.js";
export {
  compareVersions,
  isNewerVersion,
  isVersion,
  normaliseVersion,
  sortNewestFirst,
} from "./semantic-version.js";
export { runSupervisor, type RunSupervisorOptions } from "./supervisor/run-supervisor.js";
export { REPOSITORY_ROOT } from "../plugins/installed-plugins.js";
