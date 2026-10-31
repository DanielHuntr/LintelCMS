import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, Store } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChoiceCardGroup } from "./ChoiceCardGroup.js";

type Delivery = "post" | "collect";

function DeliveryPicker({ onActivate }: { onActivate: (value: Delivery) => void }) {
  const [delivery, setDelivery] = useState<Delivery>("post");
  return (
    <ChoiceCardGroup
      label="Delivery"
      value={delivery}
      onChange={setDelivery}
      onActivate={onActivate}
      options={[
        { value: "post", title: "Send by post", description: "Two to three days.", icon: Inbox },
        { value: "collect", title: "Collect", description: "Next morning.", icon: Store },
      ]}
    />
  );
}

describe("ChoiceCardGroup", () => {
  it("is a radio group whose tiles are named by their titles and described by their lines", () => {
    render(<DeliveryPicker onActivate={vi.fn()} />);

    expect(screen.getByRole("radiogroup", { name: "Delivery" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Send by post" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Collect" })).toHaveAccessibleDescription(
      "Next morning.",
    );
  });

  it("moves the choice with the arrow keys without activating it", async () => {
    const onActivate = vi.fn();
    render(<DeliveryPicker onActivate={onActivate} />);
    await userEvent.tab();

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Collect" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Collect" })).toHaveFocus();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("activates a tile on click, Enter or Space", async () => {
    const onActivate = vi.fn();
    render(<DeliveryPicker onActivate={onActivate} />);

    await userEvent.click(screen.getByRole("radio", { name: "Collect" }));
    await userEvent.keyboard("{Enter}");

    expect(onActivate).toHaveBeenNthCalledWith(1, "collect");
    expect(onActivate).toHaveBeenNthCalledWith(2, "collect");
  });
});
