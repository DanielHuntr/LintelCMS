import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { ConditionsEditor } from "./ConditionsEditor.js";
import type { ConditionTarget } from "./conditionTargets.js";

const featured: ConditionTarget = {
  reference: "featured",
  field: { handle: "featured", label: "Featured", type: "toggle" },
  where: "beside",
} as unknown as ConditionTarget;

// LINTEL-DATA-005: a condition added to a field that already held values cleared them,
// silently, the next time each entry was saved.
describe("adding a condition", () => {
  it("keeps what entries already hold when the field was saved before", async () => {
    const onChange = vi.fn();
    renderScreen(
      <ConditionsEditor
        conditions={undefined}
        targets={[featured]}
        onChange={onChange}
        isExistingField
      />,
    );

    await userEvent.click(await screen.findByRole("switch", { name: /Only show this field/ }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keepHiddenValues: true }));
  });

  it("leaves a new field to clear hidden values, as before", async () => {
    const onChange = vi.fn();
    renderScreen(
      <ConditionsEditor conditions={undefined} targets={[featured]} onChange={onChange} />,
    );

    await userEvent.click(await screen.findByRole("switch", { name: /Only show this field/ }));

    expect(onChange.mock.calls[0]?.[0]).not.toHaveProperty("keepHiddenValues");
  });
});
