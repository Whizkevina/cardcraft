import { describe, expect, it } from "vitest";
import { applySvgTextMode } from "@/lib/svgTextExport";

describe("svgTextExport", () => {
  it("returns svg unchanged for embed mode when no font families are present", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';
    const result = await applySvgTextMode(svg, "embed");
    expect(result).toBe(svg);
  });

  it("preserves svg when path conversion finds no text nodes", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>';
    const result = await applySvgTextMode(svg, "paths");
    expect(result).toContain("<circle");
  });

  it("extracts and processes text nodes in paths mode when fonts are unavailable", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20" font-family="Arial" font-size="16">Hi</text></svg>';
    const result = await applySvgTextMode(svg, "paths");
    expect(result).toContain("Hi");
  });
});
