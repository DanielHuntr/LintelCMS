import { describe, expect, it } from "vitest";
import { selectedTreeKey } from "./selectedTreeKey.js";

describe("the selected row", () => {
  it("follows the address the workspace shows", () => {
    expect(selectedTreeKey("/content")).toBeUndefined();
    expect(selectedTreeKey("/content/recycle-bin")).toBeUndefined();
    expect(selectedTreeKey("/content/pages")).toBe("root:pages");
    expect(selectedTreeKey("/content/pages/new")).toBe("root:pages");
    expect(selectedTreeKey("/content/pages/e1")).toBe("e1");
    expect(selectedTreeKey("/content/globals")).toBe("site:globals");
    expect(selectedTreeKey("/content/globals/site_settings")).toBe("globals:site_settings");
    expect(selectedTreeKey("/content/navigation/main")).toBe("menus:main");
    expect(selectedTreeKey("/content/taxonomies/tags")).toBe("taxonomies:tags");
    expect(selectedTreeKey("/media")).toBeUndefined();
  });
});
