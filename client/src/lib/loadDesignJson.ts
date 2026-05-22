import { normalizeCanvasTextObjects, sanitizeFabricJsonData } from "./fabricTextFix";

/** Layout math for fitting source canvas dimensions into display bounds */
export function computeCanvasLayout(
  srcWidth: number,
  srcHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const aspect = srcWidth / srcHeight;
  let displayWidth: number;
  let displayHeight: number;

  if (aspect >= 1) {
    displayWidth = maxWidth;
    displayHeight = Math.round(maxWidth / aspect);
  } else {
    displayHeight = maxHeight;
    displayWidth = Math.round(maxHeight * aspect);
  }

  return {
    srcWidth,
    srcHeight,
    displayWidth,
    displayHeight,
    scaleX: displayWidth / srcWidth,
    scaleY: displayHeight / srcHeight,
  };
}

export interface DesignJsonData {
  canvasWidth?: number;
  canvasHeight?: number;
  background?: string;
  objects?: any[];
}

export function parseDesignJson(designJson: string): DesignJsonData {
  const data = JSON.parse(designJson) as DesignJsonData;
  sanitizeFabricJsonData(data);
  return data;
}

export interface LoadDesignJsonOptions {
  /** When true, objects remain interactive (editor). When false, view-only (share page). */
  interactive?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  /** Called for each fabric object before it is added to the canvas */
  beforeAdd?: (sourceObj: any, fabricObj: any) => void;
  /** Max ms to wait for remote images (default 12000) */
  imageTimeoutMs?: number;
}

export interface LoadDesignJsonResult {
  srcWidth: number;
  srcHeight: number;
  displayWidth: number;
  displayHeight: number;
  scaleX: number;
  scaleY: number;
}

function buildGradient(f: any, gradDef: any, objW: number, objH: number) {
  if (!gradDef || !f.Gradient) return null;
  try {
    const stops = (gradDef.colorStops || []).map((cs: any) => ({ offset: cs.offset, color: cs.color }));
    if (gradDef.type === "radial") {
      return new f.Gradient({
        type: "radial",
        coords: {
          x1: (gradDef.coords?.x1 ?? 0.5) * objW,
          y1: (gradDef.coords?.y1 ?? 0.5) * objH,
          x2: (gradDef.coords?.x2 ?? 0.5) * objW,
          y2: (gradDef.coords?.y2 ?? 0.5) * objH,
          r1: (gradDef.coords?.r1 ?? 0) * Math.max(objW, objH),
          r2: (gradDef.coords?.r2 ?? 1) * Math.max(objW, objH),
        },
        colorStops: stops,
      });
    }
    return new f.Gradient({
      type: "linear",
      coords: {
        x1: (gradDef.coords?.x1 ?? 0) * objW,
        y1: (gradDef.coords?.y1 ?? 0) * objH,
        x2: (gradDef.coords?.x2 ?? 1) * objW,
        y2: (gradDef.coords?.y2 ?? 0) * objH,
      },
      colorStops: stops,
    });
  } catch {
    return null;
  }
}

function scaleObjectProps(obj: any, scaleX: number, scaleY: number) {
  const objW = (obj.width || (obj.radius || 50) * 2) * scaleX;
  const objH = (obj.height || (obj.radius || 50) * 2) * scaleY;

  const scaled: any = {
    ...obj,
    left: (obj.left || 0) * scaleX,
    top: (obj.top || 0) * scaleY,
    ...(obj.width !== undefined && { width: obj.width * scaleX }),
    ...(obj.height !== undefined && { height: obj.height * scaleY }),
    ...(obj.radius !== undefined && { radius: obj.radius * scaleX }),
    ...(obj.fontSize !== undefined && { fontSize: Math.round(obj.fontSize * scaleX) }),
    ...(obj.strokeWidth !== undefined && { strokeWidth: obj.strokeWidth * scaleX }),
    ...(obj.rx !== undefined && { rx: obj.rx * scaleX }),
    ...(obj.ry !== undefined && { ry: obj.ry * scaleY }),
    scaleX: obj.scaleX || 1,
    scaleY: obj.scaleY || 1,
  };

  return { scaled, objW, objH };
}

function waitForImage(
  f: any,
  src: string,
  props: any,
  sourceObj: any,
  interactive: boolean,
  timeoutMs: number,
): Promise<any> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (img: any | null) => {
      if (settled) return;
      settled = true;
      resolve(img);
    };

    const timer = window.setTimeout(() => finish(null), timeoutMs);

    f.Image.fromURL(
      src,
      (img: any) => {
        window.clearTimeout(timer);
        if (!img) {
          finish(null);
          return;
        }
        img.set({
          left: props.left,
          top: props.top,
          scaleX: sourceObj.scaleX || 1,
          scaleY: sourceObj.scaleY || 1,
          angle: sourceObj.angle || 0,
          opacity: sourceObj.opacity,
          selectable: interactive ? sourceObj.selectable !== false : false,
          evented: interactive ? sourceObj.evented !== false : false,
        });
        if (sourceObj.customType) img.customType = sourceObj.customType;
        finish(img);
      },
      { crossOrigin: "anonymous" },
    );
  });
}

/**
 * Load CardCraft design JSON onto a Fabric canvas.
 * Waits for remote images before resolving so share/OG views render completely.
 */
export async function loadDesignJson(
  canvas: any,
  designJson: string,
  options: LoadDesignJsonOptions = {},
): Promise<LoadDesignJsonResult> {
  const f = (window as any).fabric;
  if (!f) throw new Error("Fabric.js is not loaded");

  const {
    interactive = false,
    maxWidth = 480,
    maxHeight = 600,
    beforeAdd,
    imageTimeoutMs = 12000,
  } = options;

  const data = parseDesignJson(designJson);
  const srcWidth = data.canvasWidth || 800;
  const srcHeight = data.canvasHeight || 1000;
  const layout = computeCanvasLayout(srcWidth, srcHeight, maxWidth, maxHeight);

  canvas.setWidth(layout.displayWidth);
  canvas.setHeight(layout.displayHeight);
  canvas.clear();

  if (data.background) {
    canvas.setBackgroundColor(data.background, canvas.renderAll.bind(canvas));
  }

  const objects = data.objects || [];
  const pendingImages: Promise<any>[] = [];
  const gradientTimers: Promise<void>[] = [];

  for (const obj of objects) {
    const { scaled: s, objW, objH } = scaleObjectProps(obj, layout.scaleX, layout.scaleY);

    if (obj.fillGradient) {
      s.fill = buildGradient(f, obj.fillGradient, objW, objH);
    }

    if (!interactive) {
      s.selectable = false;
      s.evented = false;
    } else if (obj.locked) {
      s.selectable = false;
      s.evented = false;
    }

    const addToCanvas = (fabricObj: any) => {
      beforeAdd?.(obj, fabricObj);
      canvas.add(fabricObj);
    };

    if (obj.type === "rect") {
      addToCanvas(new f.Rect(s));
    } else if (obj.type === "circle") {
      addToCanvas(new f.Circle(s));
    } else if (obj.type === "triangle") {
      addToCanvas(new f.Triangle(s));
    } else if (obj.type === "text" || obj.type === "i-text" || obj.type === "textbox") {
      const textS = { ...s };
      delete textS.type;
      if (obj.fillGradient) {
        textS.fill = obj.fillGradient.colorStops?.[1]?.color || "#f09820";
      }
      const textObj = new f.IText(obj.text ?? "", {
        ...textS,
        fontFamily: textS.fontFamily || "Georgia",
        textBaseline: "alphabetic",
      });
      addToCanvas(textObj);

      if (obj.fillGradient) {
        gradientTimers.push(
          new Promise((resolve) => {
            window.setTimeout(() => {
              const tw = textObj.width || 300;
              const th = textObj.height || 60;
              const tg = buildGradient(f, obj.fillGradient, tw, th);
              if (tg) {
                textObj.set("fill", tg);
              }
              resolve();
            }, 50);
          }),
        );
      }
    } else if (obj.type === "image" && obj.src) {
      pendingImages.push(
        waitForImage(f, obj.src, s, obj, interactive, imageTimeoutMs).then((img) => {
          if (img) addToCanvas(img);
        }),
      );
    }
  }

  await Promise.all(pendingImages);
  await Promise.all(gradientTimers);
  normalizeCanvasTextObjects(canvas);
  canvas.renderAll();

  return layout;
}
