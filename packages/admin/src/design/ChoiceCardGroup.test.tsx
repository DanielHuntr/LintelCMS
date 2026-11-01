import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, Store } from "lucide-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ChoiceCardGroup } from "./ChoiceCardGroup.js";

type Delivery = "post" | "collect";

function DeliveryPicker() {
  const [delivery, setDelivery] = useState<Delivery>("post");
  return (
    <ChoiceCardGroup
      label="Delivery"
      value={delivery}
      onChange={setDelivery}
      options={[
        { value: "post", title: "Send by post", description: "Two to three days.", icon: Inbox },
        { value: "collect", title: "Collect", description: "Next morning.", icon: Store },
      ]}
    />
  );
}

describe("ChoiceCardGroup", () => {
  it("is a radio group whose tiles are named by their titles and described by their lines", () => {
    render(<DeliveryPicker />);

    expect(screen.getByRole("radiogroup", { name: "Delivery" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Send by post" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Collect" })).toHaveAccessibleDescription(
      "Next morning.",
    );
  });

  it("moves the choice with the arrow keys", async () => {
    render(<DeliveryPicker />);
    await userEvent.tab();

    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: "Collect" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Collect" })).toHaveFocus();
  });

  it("chooses a tile on click", async () => {
    render(<DeliveryPicker />);

    await userEvent.click(screen.getByRole("radio", { name: "Collect" }));

    expect(screen.getByRole("radio", { name: "Collect" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Send by post" })).not.toBeChecked();
  });
});
