const TEXT_TYPES = new Set(["text", "i-text", "textbox"]);
const TEXT_CUSTOM_TYPES = new Set(["greeting", "name", "date", "subtitle", "title", "bio"]);

let canvasBaselinePatched = false;

export function isTextFabricType(type: string | undefined): boolean {
  return !!type && TEXT_TYPES.has(type);
}

/** Detect editable text layers even when Fabric type metadata is missing. */
export function isTextObject(obj: any): boolean {
  if (!obj) return false;
  if (isTextFabricType(obj.type)) return true;
  if (obj.customType && TEXT_CUSTOM_TYPES.has(obj.customType)) return true;
  if (typeof obj.text === "string" && obj.type !== "image") return true;
  return false;
}

/** Fix invalid textBaseline values inside saved design / history JSON. */
export function sanitizeFabricJsonData(data: { objects?: any[] }): void {
  if (!data.objects) return;
  for (const obj of data.objects) {
    if (isTextFabricType(obj.type) || typeof obj.text === "string") {
      obj.textBaseline = "alphabetic";
      if (!obj.fontFamily || typeof obj.fontFamily !== "string") {
        obj.fontFamily = "Georgia";
      }
      if (!obj.type || typeof obj.type !== "string") {
        obj.type = "text";
      }
    }
  }
}

/** Ensure live canvas text objects use a valid baseline before render. */
export function normalizeCanvasTextObjects(canvas: { getObjects?: () => any[] } | null | undefined): void {
  if (!canvas?.getObjects) return;
  for (const obj of canvas.getObjects()) {
    if (isTextObject(obj)) {
      if (obj.textBaseline !== "alphabetic") {
        obj.textBaseline = "alphabetic";
      }
      if (!obj.fontFamily || typeof obj.fontFamily !== "string") {
        obj.fontFamily = "Georgia";
      }
      // Fabric export calls obj.type.indexOf("text") — type must be a string.
      if (!obj.type || typeof obj.type !== "string") {
        obj.type = typeof obj.isEditing === "boolean" ? "i-text" : "text";
      }
    }
  }
}

/** Normalize canvas objects immediately before PNG/SVG export. */
export function prepareCanvasForExport(canvas: { getObjects?: () => any[] } | null | undefined): void {
  normalizeCanvasTextObjects(canvas);
}

/**
 * Intercept canvas textBaseline assignments so Fabric's typo "alphabetical"
 * never hits the browser (which only accepts "alphabetic").
 */
export function patchCanvasTextBaseline(): void {
  if (canvasBaselinePatched || typeof CanvasRenderingContext2D === "undefined") return;

  const proto = CanvasRenderingContext2D.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "textBaseline");
  if (!descriptor?.set || !descriptor?.get) return;

  Object.defineProperty(proto, "textBaseline", {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get: descriptor.get,
    set(value: string) {
      descriptor.set!.call(this, value === "alphabetical" ? "alphabetic" : value);
    },
  });

  canvasBaselinePatched = true;
}

function patchTextClass(fabric: any, className: "Text" | "IText" | "Textbox"): void {
  const cls = fabric[className];
  if (!cls?.prototype || cls.prototype.__textBaselinePatched) return;

  cls.prototype.textBaseline = "alphabetic";

  const original = cls.prototype._setTextStyles;
  if (typeof original === "function") {
    cls.prototype._setTextStyles = function (
      ctx: CanvasRenderingContext2D,
      charStyle: any,
      forMeasuring?: boolean,
    ) {
      if (this.textBaseline === "alphabetical") {
        this.textBaseline = "alphabetic";
      }
      if (charStyle?.textBaseline === "alphabetical") {
        charStyle.textBaseline = "alphabetic";
      }
      return original.call(this, ctx, charStyle, forMeasuring);
    };
  }

  cls.prototype.__textBaselinePatched = true;
}

/** Patch Fabric.js text classes after the CDN script loads. */
export function patchFabricTextBaseline(fabric: any): void {
  patchCanvasTextBaseline();
  patchTextClass(fabric, "Text");
  patchTextClass(fabric, "IText");
  patchTextClass(fabric, "Textbox");
}

// Apply canvas patch as early as possible (before Fabric CDN executes).
patchCanvasTextBaseline();
