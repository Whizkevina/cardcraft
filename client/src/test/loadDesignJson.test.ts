import { describe, expect, it } from "vitest";
import { computeCanvasLayout, parseDesignJson } from "@/lib/loadDesignJson";

describe("computeCanvasLayout", () => {
  it("fits portrait canvas by height", () => {
    const layout = computeCanvasLayout(800, 1000, 480, 600);
    expect(layout.displayHeight).toBe(600);
    expect(layout.displayWidth).toBe(480);
    expect(layout.scaleX).toBeCloseTo(0.6);
    expect(layout.scaleY).toBeCloseTo(0.6);
  });

  it("fits landscape canvas by width", () => {
    const layout = computeCanvasLayout(1200, 800, 480, 600);
    expect(layout.displayWidth).toBe(480);
    expect(layout.displayHeight).toBe(320);
  });
});

describe("parseDesignJson", () => {
  it("fixes invalid textBaseline values", () => {
    const data = parseDesignJson(JSON.stringify({
      objects: [{ type: "text", text: "Hi", textBaseline: "alphabetical" }],
    }));
    expect(data.objects?.[0].textBaseline).toBe("alphabetic");
  });
});
