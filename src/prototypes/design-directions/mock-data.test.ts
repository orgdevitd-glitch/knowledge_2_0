import { describe, expect, it } from "vitest";

import { MOCK_MARKER, mockMaterials, mockPrompts } from "./mock-data";

describe("design-direction mock data", () => {
  it("is explicitly marked as mock and non-empty", () => {
    expect(MOCK_MARKER).toBe("mock-design-direction-v1");
    expect(mockMaterials.length).toBeGreaterThan(0);
    expect(mockPrompts[0]?.promptText.includes("\n")).toBe(true);
  });
});
