// Lintel's startup file for hosting control panels.
//
// In cPanel ("Setup Node.js App"), Plesk and other Passenger hosts, set the application
// startup file to app.js. It also works as `node app.js`, and for hosts that load a
// request handler from the startup file (module.exports).
//
// Settings come from the host's environment variables screen, or from a .env file in
// this folder. The whole guide is "Install on cPanel hosting" in Lintel's documentation.
"use strict";

const passenger = typeof PhusionPassenger === "undefined" ? undefined : PhusionPassenger;

const lintel = import("./packages/core/dist/hosting/hosted-app.js").then((hosting) =>
  hosting.startHostedApp({ passenger, startedDirectly: require.main === module }),
);

lintel.catch((error) => {
  console.error("Lintel's files are incomplete. Upload the whole package again.", error);
  process.exitCode = 1;
});

/** For hosts that call the startup file's handler instead of letting it listen. */
function handleRequest(request, response) {
  lintel.then(
    (app) => app.handleRequest(request, response),
    () => {
      response.statusCode = 500;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end("Lintel couldn't start because some of its files are missing.");
    },
  );
}

module.exports = handleRequest;
module.exports.lintel = lintel;
