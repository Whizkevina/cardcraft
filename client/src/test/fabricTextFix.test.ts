import { describe, expect, it } from "vitest";
import { isTextObject, normalizeCanvasTextObjects, sanitizeFabricJsonData } from "@/lib/fabricTextFix";

describe("sanitizeFabricJsonData", () => {
  it("normalizes invalid textBaseline on text objects", () => {
    const data = {
      objects: [
        { type: "text", text: "Hi", textBaseline: "alphabetical" },
        { type: "rect", fill: "#000" },
      ],
    };
    sanitizeFabricJsonData(data);
    expect(data.objects[0].textBaseline).toBe("alphabetic");
    expect(data.objects[1].textBaseline).toBeUndefined();
  });

  it("fills missing fontFamily and type on text objects", () => {
    const data = {
      objects: [{ text: "Hi", textBaseline: "alphabetic" }],
    };
    sanitizeFabricJsonData(data);
    expect(data.objects[0].fontFamily).toBe("Georgia");
    expect(data.objects[0].type).toBe("text");
  });

  it("detects text by customType when type metadata is missing", () => {
    expect(isTextObject({ customType: "date", text: "April 2026" })).toBe(true);
    expect(isTextObject({ type: "rect", fill: "#000" })).toBe(false);
  });

  it("repairs live canvas text objects missing type before export", () => {
    const obj = { text: "Hello", textBaseline: "alphabetic", type: undefined, fontFamily: undefined };
    normalizeCanvasTextObjects({ getObjects: () => [obj] });
    expect(obj.type).toBe("text");
    expect(obj.fontFamily).toBe("Georgia");
  });
});
