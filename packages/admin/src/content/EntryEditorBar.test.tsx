import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EntryEditorBar } from "./EntryEditorBar.js";

/*
 * jsdom has no layout, so this checks the classes that keep the bar clear of the fixed menu
 * and help buttons on a phone (top-4, z-20 in AdminLayout and HelpLauncher).
 */
describe("EntryEditorBar on a phone", () => {
  it("sits under the fixed buttons and starts its row below them (LINTEL-A11Y-020)", () => {
    const { container } = render(
      <EntryEditorBar
        breadcrumbs={null}
        saveIndicator={null}
        primaryAction={null}
        isPanelOpen={false}
        panelId="panel"
        onTogglePanel={() => undefined}
        onDelete={undefined}
        onDuplicate={undefined}
        isPreviewOpen={false}
        previewId="preview"
        onTogglePreview={() => undefined}
        viewPage={undefined}
      />,
    );
    const bar = container.firstElementChild;
    // Below z-20 (the buttons), and its row starts 3.5rem down, under the 52px buttons.
    expect(bar).toHaveClass("max-md:z-10", "max-md:pt-14");
    expect(bar).toHaveClass("sticky", "top-0");
  });
});
