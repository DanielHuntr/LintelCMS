import type { FormBlock, SiteForm, SiteView } from "@lintel/site-components";
import { FormNotFoundError } from "../forms/forms.errors.js";
import { describePublicForm } from "../forms/public-forms.service.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import type { SiteDependencies } from "./site-pages.service.js";
import { SITE_API_BASE } from "./page-data.service.js";
import { STYLESHEET_FOLDER } from "./site-context.service.js";

/**
 * Forms placed on pages with the Form section. They are drawn as plain HTML forms, so a
 * page published as files shows exactly what the live site shows; only where the answers
 * go differs (see FormEndpoints).
 */

/** The script that fetches a form's anti-spam token when the page opens. */
export const FORM_SCRIPT_PATH = `${STYLESHEET_FOLDER}/forms.js`;

/** Where a form's answers are posted and its token fetched. */
export interface FormEndpoints {
  action(handle: string): string;
  tokenUrl(handle: string): string;
  /**
   * Sends answers as a plain form post, not multipart: the PHP companion reads several ticked
   * boxes under one name only from a plain post.
   */
  plainPost?: boolean;
}

/** Lintel's own API at its public address: for published files on hosting without PHP. */
export function apiFormEndpoints(publicApiUrl: string): FormEndpoints {
  const base = publicApiUrl.replace(/\/+$/, "");
  return {
    action: (handle) => `${base}/delivery/forms/${encodeURIComponent(handle)}/submissions`,
    tokenUrl: (handle) => `${base}/delivery/forms/${encodeURIComponent(handle)}`,
  };
}

/** The website's own address for the forms API (site-api.routes.ts): what the live site uses. */
export function siteFormEndpoints(): FormEndpoints {
  return {
    action: (handle) => `${SITE_API_BASE}/forms/${encodeURIComponent(handle)}/submissions`,
    tokenUrl: (handle) => `${SITE_API_BASE}/forms/${encodeURIComponent(handle)}`,
  };
}

/** Fills in each Form section's form. Without the Forms plugin, the sections are left out. */
export async function attachForms<View extends SiteView>(
  dependencies: SiteDependencies,
  view: View,
): Promise<View> {
  if (view.kind !== "page" || !view.sections.some((block) => block.type === "form")) {
    return view;
  }
  if (!(await isPluginEnabled(dependencies.database, "forms"))) {
    return { ...view, sections: view.sections.filter((block) => block.type !== "form") };
  }
  const endpoints = dependencies.formEndpoints ?? siteFormEndpoints();
  const sections = await Promise.all(
    view.sections.map(async (block) =>
      block.type === "form"
        ? { ...block, form: await loadForm(dependencies, block, endpoints) }
        : block,
    ),
  );
  return { ...view, sections };
}

async function loadForm(
  dependencies: SiteDependencies,
  block: FormBlock,
  endpoints: FormEndpoints,
): Promise<SiteForm | null> {
  try {
    const form = await describePublicForm(dependencies.database, block.handle);
    return {
      handle: form.handle,
      name: form.name,
      submitLabel: form.submitLabel,
      acceptingSubmissions: form.acceptingSubmissions,
      action: endpoints.action(form.handle),
      tokenUrl: endpoints.tokenUrl(form.handle),
      scriptUrl: FORM_SCRIPT_PATH,
      honeypotField: form.spamProtection.honeypotField,
      tokenField: form.spamProtection.tokenField,
      fields: form.fields.map((field) => ({
        handle: field.handle,
        type: field.type,
        label: field.label,
        helpText: field.helpText,
        placeholder: field.placeholder,
        required: field.required,
        choices: Array.isArray(field.options.choices)
          ? field.options.choices.filter((choice): choice is string => typeof choice === "string")
          : [],
      })),
    };
  } catch (error) {
    if (error instanceof FormNotFoundError) {
      return null;
    }
    throw error;
  }
}

/**
 * The script behind FORM_SCRIPT_PATH: asks each form's token address for a fresh token
 * and puts it in the hidden field. Plain ES5, so it is served as it is.
 */
export const formTokenScript = `(function () {
  "use strict";
  var forms = document.querySelectorAll("form[data-lintel-token-url]");
  Array.prototype.forEach.call(forms, function (form) {
    if (form.getAttribute("data-lintel-ready")) return;
    form.setAttribute("data-lintel-ready", "yes");
    fetch(form.getAttribute("data-lintel-token-url"), { headers: { accept: "application/json" } })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (answer) {
        var token = answer && (answer.token || (answer.spamProtection && answer.spamProtection.token));
        var input = form.querySelector('input[name="_token"]');
        if (token && input) input.value = token;
      })
      .catch(function () {});
  });
})();
`;
