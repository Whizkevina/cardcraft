/**
 * Render template canvas JSON to a JPEG data URL (browser only — requires Fabric).
 * Used as runtime fallback when preview_image is missing.
 */
import { loadFabric } from "./loadFabric";

const PREVIEW_MULTIPLIER = 0.45;
const PREVIEW_QUALITY = 0.88;

export async function renderCanvasJsonToDataUrl(canvasJson: string): Promise<string> {
  await loadFabric();
  const f = (window as any).fabric;

  return new Promise((resolve, reject) => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(canvasJson);
    } catch {
      reject(new Error("Invalid canvas JSON"));
      return;
    }

    const w = Number(data.canvasWidth) || 800;
    const h = Number(data.canvasHeight) || 1000;
    const el = document.createElement("canvas");
    const canvas = new f.StaticCanvas(el, { width: w, height: h });

    canvas.loadFromJSON(data, () => {
      canvas.renderAll();
      window.setTimeout(() => {
        try {
          const url = canvas.toDataURL({
            format: "jpeg",
            quality: PREVIEW_QUALITY,
            multiplier: PREVIEW_MULTIPLIER,
          });
          canvas.dispose();
          resolve(url);
        } catch (err) {
          canvas.dispose();
          reject(err);
        }
      }, 250);
    });
  });
}
