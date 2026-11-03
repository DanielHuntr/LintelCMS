import { afterEach, describe, expect, it, vi } from "vitest";
import { setUpForms } from "./form-behaviours.js";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

function formOnPage(): HTMLFormElement {
  document.body.innerHTML = `
    <form data-behaviour="form" action="/_lintel/api/forms/contact">
      <input name="email" value="ana@example.com">
      <button type="submit">Send</button>
      <p class="lintel-form__status"></p>
    </form>`;
  const form = document.querySelector("form");
  if (!form) throw new Error("No form on the page.");
  setUpForms(document);
  return form;
}

describe("forms on the website", () => {
  it("tells the page when a form was sent, for an A/B test's goal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ confirmation: { message: "Thanks." } }))),
    );
    const sent = vi.fn();
    document.addEventListener("lintel:form-sent", sent);
    const form = formOnPage();

    form.requestSubmit();
    await vi.waitFor(() =>
      expect(form.querySelector(".lintel-form__status")?.textContent).toBe("Thanks."),
    );
    expect(sent).toHaveBeenCalledTimes(1);
    document.removeEventListener("lintel:form-sent", sent);
  });

  it("sends a plain form post on a site published as files", async () => {
    const send = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", send);
    const form = formOnPage();
    form.dataset.plainPost = "";

    form.requestSubmit();
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    const [, request] = send.mock.calls[0] as unknown as [string, { body: unknown }];
    expect(String(request.body)).toBe("email=ana%40example.com");
  });

  it("says nothing when the form was refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ message: "Check the form." }), { status: 400 }),
      ),
    );
    const sent = vi.fn();
    document.addEventListener("lintel:form-sent", sent);
    const form = formOnPage();

    form.requestSubmit();
    await vi.waitFor(() =>
      expect(form.querySelector(".lintel-form__status")?.textContent).toBe("Check the form."),
    );
    expect(sent).not.toHaveBeenCalled();
    document.removeEventListener("lintel:form-sent", sent);
  });
});
