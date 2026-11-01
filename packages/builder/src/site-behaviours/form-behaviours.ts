import { eachBehaviour } from "./behaviour-helpers.js";

/**
 * Forms send their answers in the background and show the thank-you message, or each
 * problem beside its field, without leaving the page. Without script they post normally.
 */
export function setUpForms(root: ParentNode): void {
  eachBehaviour<HTMLFormElement>(root, "form", (form) => {
    const status = form.querySelector<HTMLElement>(".lintel-form__status");
    form.addEventListener("submit", async (event) => {
      if (!form.action) return;
      event.preventDefault();
      const button = form.querySelector<HTMLButtonElement>("button[type=submit]");
      if (button) button.disabled = true;
      form.querySelectorAll<HTMLElement>("[data-error-for]").forEach((error) => {
        error.hidden = true;
        error.textContent = "";
      });
      try {
        const response = await fetch(form.action, {
          method: "POST",
          headers: { accept: "application/json" },
          body: new FormData(form),
        });
        const answer = (await response.json().catch(() => ({}))) as {
          message?: string;
          fields?: Record<string, string>;
          confirmation?: { message?: string; redirectUrl?: string };
        };
        if (response.ok) {
          if (answer.confirmation?.redirectUrl) {
            window.location.assign(answer.confirmation.redirectUrl);
            return;
          }
          form.reset();
          if (status)
            status.textContent =
              answer.confirmation?.message || form.dataset.confirmation || "Thank you.";
          return;
        }
        for (const [handle, message] of Object.entries(answer.fields ?? {})) {
          const error = form.querySelector<HTMLElement>(`[data-error-for="${CSS.escape(handle)}"]`);
          if (error) {
            error.textContent = message;
            error.hidden = false;
          }
        }
        if (status)
          status.textContent = answer.message ?? "Something went wrong. Please try again.";
        form
          .querySelector<HTMLElement>("[data-error-for]:not([hidden])")
          ?.parentElement?.querySelector<HTMLElement>("input, select, textarea")
          ?.focus();
      } catch {
        if (status)
          status.textContent = "We couldn’t send that. Please check your connection and try again.";
      } finally {
        if (button) button.disabled = false;
      }
    });
  });
}
