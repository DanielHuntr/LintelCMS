import { installSiteRuntime } from "./site-runtime.js";

// The entry point of dist/site-runtime.js: runs as soon as the page loads it.
installSiteRuntime(window);
