/**
 * The embeddable script websites add to show a form, served at `/delivery/forms.js`:
 *
 *   <script src="https://cms.example.com/delivery/forms.js" data-form="contact"></script>
 *
 * It reads the form from the delivery API, draws it with plain, labelled HTML (each error
 * tied to its field, multi-step forms one step at a time), checks answers in the browser,
 * and posts them back. The server checks everything again. It works with any site or
 * framework; `window.LintelForms.render(element, handle, { apiUrl })` draws a form into an
 * element by hand. See the "Forms API" docs for the options.
 *
 * Kept as plain ES2017 in a string, so it can be served as it is, with no build step.
 */
export const formsEmbedScript = String.raw`(function () {
  "use strict";
  if (window.LintelForms) return;

  var STYLE_ID = "lintel-forms-styles";
  var STYLES = [
    ".lintel-form{--lintel-form-accent:#7539fd;--lintel-form-danger:#c62828;display:grid;gap:1rem;max-width:40rem;font:inherit;color:inherit}",
    ".lintel-form fieldset{border:0;margin:0;padding:0;display:grid;gap:1rem;min-width:0}",
    ".lintel-form legend{font-weight:600;font-size:1.1em;padding:0;margin-bottom:.25rem}",
    ".lintel-form__field{display:grid;gap:.35rem}",
    ".lintel-form__label{font-weight:600}",
    ".lintel-form__required{color:var(--lintel-form-danger);margin-left:.15em}",
    ".lintel-form__help{font-size:.9em;opacity:.75;margin:0}",
    ".lintel-form input:not([type=checkbox]):not([type=radio]),.lintel-form textarea,.lintel-form select{font:inherit;color:inherit;background:transparent;border:1px solid color-mix(in srgb,currentColor 35%,transparent);border-radius:.5rem;padding:.6rem .75rem;width:100%;box-sizing:border-box}",
    ".lintel-form textarea{min-height:8rem;resize:vertical}",
    ".lintel-form :focus-visible{outline:2px solid var(--lintel-form-accent);outline-offset:2px}",
    ".lintel-form__option{display:flex;gap:.5rem;align-items:flex-start}",
    ".lintel-form__option input{margin-top:.25em;accent-color:var(--lintel-form-accent)}",
    ".lintel-form__error{color:var(--lintel-form-danger);font-size:.9em;margin:0}",
    ".lintel-form__error:empty{display:none}",
    ".lintel-form [aria-invalid=true]{border-color:var(--lintel-form-danger)!important}",
    ".lintel-form__actions{display:flex;gap:.75rem;flex-wrap:wrap}",
    ".lintel-form button{font:inherit;font-weight:600;border-radius:.5rem;padding:.65rem 1.25rem;cursor:pointer;border:1px solid var(--lintel-form-accent)}",
    ".lintel-form button[type=submit],.lintel-form__next{background:var(--lintel-form-accent);color:#fff}",
    ".lintel-form__back{background:transparent;color:inherit}",
    ".lintel-form button[disabled]{opacity:.6;cursor:progress}",
    ".lintel-form__progress{font-size:.9em;opacity:.75;margin:0}",
    ".lintel-form [hidden]{display:none!important}",
    ".lintel-form__trap{position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden}",
    ".lintel-form__message{padding:1rem;border-radius:.5rem;border:1px solid color-mix(in srgb,currentColor 20%,transparent)}",
    ".lintel-form__problem{color:var(--lintel-form-danger)}"
  ].join("\n");

  var TEXT = {
    loading: "Loading the form…",
    unavailable: "This form can’t be shown right now. Please try again later.",
    sending: "Sending…",
    next: "Next",
    back: "Back",
    step: "Step {number} of {count}",
    fixProblems: "Some answers need attention. Please check the highlighted fields.",
    failed: "Your answers couldn’t be sent. Check your connection and try again.",
    closed: "This form isn’t taking submissions at the moment.",
    choose: "Choose…",
    leaveEmpty: "Leave this empty"
  };

  function text(key, values) {
    return TEXT[key].replace(/\{(\w+)\}/g, function (match, name) {
      return values && name in values ? String(values[name]) : match;
    });
  }

  function element(tag, attributes, children) {
    var node = document.createElement(tag);
    Object.keys(attributes || {}).forEach(function (name) {
      var value = attributes[name];
      if (value === false || value === null || value === undefined) return;
      if (name === "text") node.textContent = value;
      else node.setAttribute(name, value === true ? "" : String(value));
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = element("style", { id: STYLE_ID });
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  var counter = 0;

  function fieldControl(field, id, describedBy, prefill) {
    var options = field.options || {};
    var common = { id: id, name: field.handle, required: field.required, "aria-describedby": describedBy };
    switch (field.type) {
      case "longText":
        return element("textarea", Object.assign({}, common, { placeholder: field.placeholder || null, maxlength: options.maxLength, minlength: options.minLength, text: prefill || "" }));
      case "dropdown":
        var select = element("select", common, [element("option", { value: "", text: text("choose") })]);
        options.choices.forEach(function (choice) {
          select.appendChild(element("option", { value: choice, text: choice, selected: prefill === choice }));
        });
        return select;
      case "file":
        var accept = (options.allowedKinds || []).map(function (kind) {
          return kind === "images" ? "image/*" : ".pdf,.docx,.xlsx,.pptx,.txt,.csv";
        }).join(",");
        return element("input", Object.assign({}, common, { type: "file", accept: accept || null, multiple: options.maxFiles > 1, "data-max-megabytes": options.maxMegabytes }));
      default:
        var types = { shortText: "text", email: "email", phone: "tel", number: "number", date: "date" };
        var autocomplete = { email: "email", phone: "tel" };
        return element("input", Object.assign({}, common, {
          type: types[field.type] || "text",
          placeholder: field.placeholder || null,
          maxlength: options.maxLength,
          minlength: options.minLength,
          min: field.type === "date" ? options.earliest : options.min,
          max: field.type === "date" ? options.latest : options.max,
          step: field.type === "number" ? (options.wholeNumber ? 1 : "any") : null,
          inputmode: field.type === "number" ? (options.wholeNumber ? "numeric" : "decimal") : null,
          autocomplete: autocomplete[field.type] || (field.handle === "name" ? "name" : null),
          value: prefill || null
        }));
    }
  }

  function renderField(field, formId, prefill) {
    var id = formId + "-" + field.handle;
    var helpId = id + "-help";
    var errorId = id + "-error";
    var describedBy = (field.helpText ? helpId + " " : "") + errorId;
    var help = field.helpText ? element("p", { id: helpId, class: "lintel-form__help", text: field.helpText }) : null;
    var error = element("p", { id: errorId, class: "lintel-form__error", "data-error-for": field.handle });
    var requiredMark = field.required ? element("span", { class: "lintel-form__required", "aria-hidden": "true", text: "*" }) : null;

    if (field.type === "hidden") {
      return element("input", { type: "hidden", name: field.handle, value: prefill || field.options.defaultValue || "" });
    }
    if (field.type === "consent") {
      var box = element("input", { type: "checkbox", id: id, name: field.handle, value: "true", required: field.required, "aria-describedby": describedBy });
      return element("div", { class: "lintel-form__field", "data-field": field.handle }, [
        element("label", { class: "lintel-form__option", for: id }, [box, element("span", { text: field.label }), requiredMark]),
        help,
        error
      ]);
    }
    if (field.type === "choice" || field.type === "checkboxes") {
      var group = element("fieldset", { class: "lintel-form__field", "data-field": field.handle, "aria-describedby": describedBy, role: field.type === "choice" ? "radiogroup" : null, "aria-required": field.required && field.type === "choice" ? "true" : null }, [
        element("legend", { class: "lintel-form__label", text: field.label }, [requiredMark])
      ]);
      field.options.choices.forEach(function (choice, index) {
        var optionId = id + "-" + index;
        group.appendChild(element("label", { class: "lintel-form__option", for: optionId }, [
          element("input", { type: field.type === "choice" ? "radio" : "checkbox", id: optionId, name: field.handle, value: choice, required: field.required && field.type === "choice", checked: prefill === choice }),
          element("span", { text: choice })
        ]));
      });
      if (help) group.appendChild(help);
      group.appendChild(error);
      return group;
    }
    return element("div", { class: "lintel-form__field", "data-field": field.handle }, [
      element("label", { class: "lintel-form__label", for: id, text: field.label }, [requiredMark]),
      help,
      fieldControl(field, id, describedBy, prefill),
      error
    ]);
  }

  function prefillsFrom(container) {
    var values = {};
    Array.prototype.forEach.call(container.attributes || [], function (attribute) {
      if (attribute.name.indexOf("data-field-") === 0) values[attribute.name.slice(11).replace(/-/g, "_")] = attribute.value;
    });
    return values;
  }

  function loadTurnstile() {
    if (document.querySelector("script[data-lintel-turnstile]")) return;
    document.head.appendChild(element("script", { src: "https://challenges.cloudflare.com/turnstile/v0/api.js", async: true, defer: true, "data-lintel-turnstile": true }));
  }

  function render(container, handle, options) {
    options = options || {};
    var apiUrl = String(options.apiUrl || "").replace(/\/+$/, "");
    var prefill = Object.assign(prefillsFrom(container), options.values || {});
    if (options.styles !== false) addStyles();
    var status = element("p", { class: "lintel-form__progress", role: "status", text: text("loading") });
    container.replaceChildren(status);

    return fetch(apiUrl + "/delivery/forms/" + encodeURIComponent(handle), { headers: { accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("Form " + handle + " answered " + response.status);
        return response.json();
      })
      .then(function (schema) {
        buildForm(container, schema, apiUrl, prefill);
      })
      .catch(function () {
        status.textContent = text("unavailable");
      });
  }

  function buildForm(container, schema, apiUrl, prefill) {
    counter += 1;
    var formId = "lintel-form-" + schema.handle + "-" + counter;
    var fieldsByHandle = {};
    schema.fields.forEach(function (field) { fieldsByHandle[field.handle] = field; });

    var form = element("form", { class: "lintel-form", id: formId, novalidate: true, "aria-label": schema.name });
    var summary = element("p", { class: "lintel-form__problem", role: "alert", tabindex: "-1", hidden: true });
    form.appendChild(summary);

    var steps = schema.steps.map(function (step, index) {
      var fieldset = element("fieldset", { "data-step": index, hidden: index > 0 });
      if (schema.steps.length > 1) {
        fieldset.appendChild(element("p", { class: "lintel-form__progress", text: text("step", { number: index + 1, count: schema.steps.length }) }));
      }
      if (step.title) fieldset.appendChild(element("legend", { text: step.title }));
      step.fields.forEach(function (fieldHandle) {
        var field = fieldsByHandle[fieldHandle];
        if (field) fieldset.appendChild(renderField(field, formId, prefill[fieldHandle]));
      });
      form.appendChild(fieldset);
      return fieldset;
    });

    var spam = schema.spamProtection;
    form.appendChild(element("div", { class: "lintel-form__trap", "aria-hidden": "true" }, [
      element("label", { for: formId + "-trap", text: text("leaveEmpty") }),
      element("input", { id: formId + "-trap", name: spam.honeypotField, type: "text", tabindex: "-1", autocomplete: "off" })
    ]));
    form.appendChild(element("input", { type: "hidden", name: spam.tokenField, value: spam.token }));
    if (spam.turnstileSiteKey) {
      loadTurnstile();
      form.appendChild(element("div", { class: "cf-turnstile", "data-sitekey": spam.turnstileSiteKey }));
    }

    var back = element("button", { type: "button", class: "lintel-form__back", text: text("back"), hidden: true });
    var next = element("button", { type: "button", class: "lintel-form__next", text: text("next"), hidden: steps.length < 2 });
    var submit = element("button", { type: "submit", text: schema.submitLabel, hidden: steps.length > 1 });
    form.appendChild(element("div", { class: "lintel-form__actions" }, [back, next, submit]));

    var current = 0;
    function showStep(index, focusFirst) {
      current = index;
      steps.forEach(function (step, stepIndex) { step.hidden = stepIndex !== index; });
      back.hidden = index === 0;
      next.hidden = index === steps.length - 1;
      submit.hidden = index !== steps.length - 1;
      if (focusFirst) {
        var first = steps[index].querySelector("input:not([type=hidden]),select,textarea");
        if (first) first.focus();
      }
    }

    function clearErrors() {
      summary.hidden = true;
      form.querySelectorAll("[data-error-for]").forEach(function (node) { node.textContent = ""; });
      form.querySelectorAll("[aria-invalid]").forEach(function (node) { node.removeAttribute("aria-invalid"); });
    }

    function showErrors(messages) {
      var firstHandle = null;
      Object.keys(messages).forEach(function (fieldHandle) {
        var message = form.querySelector('[data-error-for="' + fieldHandle + '"]');
        if (!message) return;
        message.textContent = messages[fieldHandle];
        var wrapper = form.querySelector('[data-field="' + fieldHandle + '"]');
        wrapper.querySelectorAll("input,select,textarea").forEach(function (control) { control.setAttribute("aria-invalid", "true"); });
        if (firstHandle === null) firstHandle = fieldHandle;
      });
      summary.textContent = text("fixProblems");
      summary.hidden = false;
      if (firstHandle !== null) {
        var stepIndex = steps.findIndex(function (step) { return step.querySelector('[data-field="' + firstHandle + '"]'); });
        if (stepIndex >= 0) showStep(stepIndex, false);
        var control = form.querySelector('[data-field="' + firstHandle + '"] input,[data-field="' + firstHandle + '"] select,[data-field="' + firstHandle + '"] textarea');
        if (control) control.focus();
      } else {
        summary.focus();
      }
    }

    function checkStep(index) {
      var messages = {};
      steps[index].querySelectorAll("[data-field]").forEach(function (wrapper) {
        var fieldHandle = wrapper.getAttribute("data-field");
        var field = fieldsByHandle[fieldHandle];
        var controls = wrapper.querySelectorAll("input,select,textarea");
        if (field.type === "checkboxes" && field.required && !wrapper.querySelector("input:checked")) {
          messages[fieldHandle] = field.label + " is required";
          return;
        }
        Array.prototype.some.call(controls, function (control) {
          if (control.checkValidity()) return false;
          messages[fieldHandle] = field.type === "consent" && control.validity.valueMissing ? "Please tick this box to continue" : control.validity.valueMissing ? field.label + " is required" : control.validationMessage;
          return true;
        });
        if (field.type === "file" && !messages[fieldHandle]) {
          var limit = Number(controls[0].getAttribute("data-max-megabytes")) * 1024 * 1024;
          var files = Array.prototype.slice.call(controls[0].files || []);
          if (files.length > field.options.maxFiles) messages[fieldHandle] = field.label + " takes at most " + field.options.maxFiles + " files";
          files.forEach(function (file) { if (limit && file.size > limit) messages[fieldHandle] = "“" + file.name + "” is bigger than " + field.options.maxMegabytes + " MB"; });
        }
      });
      clearErrors();
      if (Object.keys(messages).length > 0) {
        showErrors(messages);
        return false;
      }
      return true;
    }

    back.addEventListener("click", function () { showStep(current - 1, true); });
    next.addEventListener("click", function () { if (checkStep(current)) showStep(current + 1, true); });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (current < steps.length - 1) {
        if (checkStep(current)) showStep(current + 1, true);
        return;
      }
      for (var index = 0; index < steps.length; index += 1) {
        if (!checkStep(index)) return;
      }
      submit.disabled = true;
      submit.textContent = text("sending");
      var body = new FormData(form);
      body.append("_source", window.location.href);
      fetch(apiUrl + "/delivery/forms/" + encodeURIComponent(schema.handle) + "/submissions", { method: "POST", body: body, headers: { accept: "application/json" } })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (result) { return { ok: response.ok, status: response.status, result: result }; });
        })
        .then(function (answer) {
          submit.disabled = false;
          submit.textContent = schema.submitLabel;
          if (!answer.ok) {
            if (answer.result.fields) showErrors(answer.result.fields);
            else {
              summary.textContent = answer.result.message || text("failed");
              summary.hidden = false;
              summary.focus();
            }
            return;
          }
          container.dispatchEvent(new CustomEvent("lintel-form:submitted", { bubbles: true, detail: { form: schema.handle } }));
          var confirmation = answer.result.confirmation || schema.confirmation;
          if (confirmation.type === "redirect") {
            window.location.assign(confirmation.url);
            return;
          }
          var message = element("div", { class: "lintel-form__message", role: "status", tabindex: "-1" });
          confirmation.message.split(/\n+/).forEach(function (line) { message.appendChild(element("p", { text: line })); });
          container.replaceChildren(message);
          message.focus();
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = schema.submitLabel;
          summary.textContent = text("failed");
          summary.hidden = false;
          summary.focus();
        });
    });

    if (!schema.acceptingSubmissions) {
      container.replaceChildren(element("p", { class: "lintel-form__message", text: text("closed") }));
      return;
    }
    container.replaceChildren(form);
  }

  function apiUrlOf(script) {
    if (script.getAttribute("data-api")) return script.getAttribute("data-api");
    var source = script.getAttribute("src") || "";
    return new URL(source, window.location.href).href.replace(/\/delivery\/forms\.js(\?.*)?$/, "");
  }

  function start() {
    document.querySelectorAll("script[data-form]").forEach(function (script) {
      if (script.hasAttribute("data-lintel-started")) return;
      script.setAttribute("data-lintel-started", "");
      var targetSelector = script.getAttribute("data-target");
      var container = targetSelector ? document.querySelector(targetSelector) : null;
      if (!container) {
        container = document.createElement("div");
        script.parentNode.insertBefore(container, script.nextSibling);
      }
      Array.prototype.forEach.call(script.attributes, function (attribute) {
        if (attribute.name.indexOf("data-field-") === 0) container.setAttribute(attribute.name, attribute.value);
      });
      render(container, script.getAttribute("data-form"), { apiUrl: apiUrlOf(script), styles: script.getAttribute("data-styles") !== "none" });
    });
  }

  window.LintelForms = { render: render, start: start };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
`;
