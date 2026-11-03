import { escapeHtml } from "@lintel/core/plugin";

/**
 * The sign-up form visitors see, for the builder's element and the Liquid tag. It is a real
 * form that works without JavaScript (the server answers a plain post with a short page);
 * the small script after it sends it in the background and shows the answer in place.
 * Class names start with `newsletter-` and the styling is light, so the site's look shows.
 */

/** Where the form posts: the website passes it on to the add-on's route on the API. */
export const SIGN_UP_ACTION = "/_lintel/api/addons/newsletter/subscribe";

export interface SignUpFormText {
  heading: string;
  text: string;
  buttonLabel: string;
  consentLabel: string;
}

export const defaultSignUpFormText: SignUpFormText = {
  heading: "Get our newsletter",
  text: "",
  buttonLabel: "Sign up",
  consentLabel: "I'd like the newsletter. I can unsubscribe at any time.",
};

/**
 * The script, run once per page however many forms it has. Plain ES2015 with no braces
 * doubled up, so it can sit inside a block template.
 */
export const SIGN_UP_SCRIPT = [
  "(function(){",
  'document.querySelectorAll("form.newsletter-form:not([data-newsletter-ready])").forEach(function(form){',
  'form.setAttribute("data-newsletter-ready","");',
  'form.addEventListener("submit",function(event){',
  "event.preventDefault();",
  'var status=form.querySelector(".newsletter-status");',
  'var button=form.querySelector("button[type=submit]");',
  "button.disabled=true;",
  'status.textContent="Signing you up…";',
  'fetch(form.action,{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(form)))})',
  ".then(function(response){return response.json().then(function(body){",
  'status.textContent=body.message||"Something went wrong. Please try again.";',
  "if(response.ok){form.reset();}",
  "});})",
  '.catch(function(){status.textContent="That didn\'t go through. Check your connection and try again.";})',
  ".finally(function(){button.disabled=false;});",
  "});",
  "});",
  "})();",
].join("");

/**
 * The form, with `{{slot}}` markers or finished text in each place: the block's template
 * passes markers, the Liquid tag passes escaped text.
 */
function formMarkup(text: SignUpFormText, textSection: string): string {
  // The website's own Newsletter element's classes, so the site's styles draw it the same way.
  return [
    '<section class="lintel-newsletter newsletter-signup">',
    `<h2 class="lintel-newsletter__title newsletter-heading">${text.heading}</h2>`,
    textSection,
    `<form class="lintel-newsletter__form newsletter-form" method="post" action="${SIGN_UP_ACTION}">`,
    '<label class="lintel-newsletter__label newsletter-label">Email address',
    '<span class="lintel-newsletter__row">',
    '<input class="newsletter-email" name="email" type="email" autocomplete="email" required>',
    `<button class="lintel-button newsletter-button" type="submit">${text.buttonLabel}</button>`,
    "</span></label>",
    '<div class="lintel-form__trap" aria-hidden="true">',
    '<label>Leave this empty <input name="website" type="text" tabindex="-1" autocomplete="off"></label>',
    "</div>",
    '<label class="lintel-form__choice newsletter-consent">',
    `<input name="consent" type="checkbox" required> <span>${text.consentLabel}</span>`,
    "</label>",
    '<p class="lintel-form__status newsletter-status" role="status" aria-live="polite"></p>',
    "</form>",
    `<script>${SIGN_UP_SCRIPT}</script>`,
    "</section>",
  ].join("");
}

/** The builder element's template, with the block's properties in its slots. */
export const signUpBlockTemplate = formMarkup(
  {
    heading: "{{heading}}",
    text: "",
    buttonLabel: "{{button_label}}",
    consentLabel: "{{consent_label}}",
  },
  '{{#text}}<p class="lintel-newsletter__text newsletter-text">{{text}}</p>{{/text}}',
);

/** `{% newsletter_signup heading: "…", button: "…" %}`: the form, its text escaped. */
export function renderSignUpForm(options: Record<string, unknown>): string {
  const read = (name: string, fallback: string) =>
    escapeHtml(typeof options[name] === "string" ? options[name] : fallback);
  const text: SignUpFormText = {
    heading: read("heading", defaultSignUpFormText.heading),
    text: read("text", defaultSignUpFormText.text),
    buttonLabel: read("button", defaultSignUpFormText.buttonLabel),
    consentLabel: read("consent", defaultSignUpFormText.consentLabel),
  };
  const textSection = text.text
    ? `<p class="lintel-newsletter__text newsletter-text">${text.text}</p>`
    : "";
  return formMarkup(text, textSection);
}

/** The page a browser gets after a plain form post, when scripts are off. */
export function plainAnswerPage(message: string, backTo: string | undefined): string {
  const back = backTo ? `<p><a href="${escapeHtml(backTo)}">Go back</a></p>` : "";
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Newsletter</title>' +
    "<style>body{font:1rem/1.5 system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem}</style>" +
    `</head><body><p>${escapeHtml(message)}</p>${back}</body></html>`
  );
}
