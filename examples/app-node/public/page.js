// The script every page of the app runs inside the Lintel admin. Plain JavaScript and the
// bridge, nothing to build: an app with a C#, Python or PHP backend can serve the same file.
import { createAppBridge } from "/assets/app-bridge/index.js";

const root = document.getElementById("app");
const lintel = createAppBridge();

try {
  const { context } = await lintel.ready();
  document.documentElement.dataset.theme = context.theme;
  lintel.autoResize();

  // Asking our own server, with a fresh session token it verifies before answering.
  const entryId = context.entry?.id;
  const response = await lintel.fetch(`/api/log${entryId ? `?entryId=${entryId}` : ""}`);
  const log = await response.json();
  if (!response.ok) {
    show([paragraph(log.message, "quiet")]);
  } else {
    show(viewFor(context, log));
  }
} catch (error) {
  show([paragraph(`This page can only be used inside Lintel. (${error.message})`, "quiet")]);
}

function viewFor(context, log) {
  const events = context.extension === "widget" ? log.events.slice(0, 5) : log.events;
  const list = events.length
    ? element(
        "ul",
        {},
        events.map((event) =>
          element("li", {}, [
            `${event.title} `,
            element("span", { className: "quiet" }, [describe(event)]),
          ]),
        ),
      )
    : paragraph(
        context.extension === "panel"
          ? "Nothing logged for this entry yet. Publish it and it shows here."
          : "Nothing published since the app was installed.",
        "quiet",
      );

  if (context.extension === "panel" || context.extension === "widget") {
    return [list];
  }
  if (context.extension === "settings") {
    return [
      element("h1", {}, ["Publishing Log settings"]),
      paragraph(
        log.collectionCount === null
          ? "Lintel's API couldn't be reached from the app's server."
          : `Connected. The app can see ${log.collectionCount} collections.`,
        "quiet",
      ),
      paragraph(`What it may do for you: ${log.you.permissions.join(", ") || "nothing"}.`, "quiet"),
    ];
  }
  return [
    element("h1", {}, [`Hello, ${context.user.name}`]),
    paragraph("Everything published on your site, newest first.", "quiet"),
    list,
    button("Go to your content", () => lintel.navigate("/content")),
    button("Say thanks", () =>
      lintel.toast("Thanks for trying the example app", { tone: "success" }),
    ),
  ];
}

function describe(event) {
  const what = event.event === "entry.published" ? "published" : "unpublished";
  return `${what} ${new Date(event.at).toLocaleString()}`;
}

function show(children) {
  root.replaceChildren(...children);
}

function paragraph(text, className) {
  return element("p", { className }, [text]);
}

function button(label, onClick) {
  const made = element("button", { type: "button" }, [label]);
  made.addEventListener("click", onClick);
  return made;
}

// Text always goes in as text nodes, never as HTML, so titles can't inject anything.
function element(tag, properties, children) {
  const made = Object.assign(document.createElement(tag), properties);
  made.append(...children);
  return made;
}
