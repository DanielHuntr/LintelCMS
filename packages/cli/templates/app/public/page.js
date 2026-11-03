// The script the app's page runs inside the Lintel admin. Plain JavaScript and the bridge,
// nothing to build.
import { createAppBridge } from "/assets/app-bridge/index.js";

const root = document.getElementById("app");
const lintel = createAppBridge();

try {
  const { context } = await lintel.ready();
  document.documentElement.dataset.theme = context.theme;
  lintel.autoResize();

  // Asking this app's own server, with a fresh session token it checks before answering.
  const response = await lintel.fetch("/api/hello");
  const answer = await response.json();
  if (!response.ok) {
    show([paragraph(answer.message, "quiet")]);
  } else {
    show([
      element("h1", {}, [`Hello, ${context.user.name}`]),
      paragraph(
        answer.collections === null
          ? "The app couldn't reach Lintel's API from its server."
          : `Connected. The app can see ${answer.collections} collections.`,
        "quiet",
      ),
      answer.published.length
        ? element(
            "ul",
            {},
            answer.published.map((item) => element("li", {}, [item.title])),
          )
        : paragraph("Publish something and it shows here.", "quiet"),
      button("Say hello", () => lintel.toast("Hello from __APP_NAME__", { tone: "success" })),
    ]);
  }
} catch (error) {
  show([paragraph(`This page only works inside Lintel. (${error.message})`, "quiet")]);
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

// Text always goes in as text, never as HTML, so titles can't inject anything.
function element(tag, properties, children) {
  const made = Object.assign(document.createElement(tag), properties);
  made.append(...children);
  return made;
}
