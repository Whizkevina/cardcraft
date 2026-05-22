/** Fabric.js 5.x loaded from CDN — matches template JSON and editor APIs in use. */
export const FABRIC_CDN_URL =
  "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js";

import { patchFabricTextBaseline } from "./fabricTextFix";

let loadPromise: Promise<any> | null = null;

export function getFabric(): any | null {
  const fabric = (window as any).fabric ?? null;
  if (fabric) prepareFabric(fabric);
  return fabric;
}

function prepareFabric(fabric: any): any {
  patchFabricTextBaseline(fabric);
  return fabric;
}

export function loadFabric(): Promise<any> {
  const existing = getFabric();
  if (existing) return Promise.resolve(prepareFabric(existing));

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FABRIC_CDN_URL;
      script.async = true;
      script.onload = () => {
        const fabric = getFabric();
        if (fabric) resolve(prepareFabric(fabric));
        else {
          loadPromise = null;
          reject(new Error("Fabric.js loaded but window.fabric is missing"));
        }
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("Failed to load Fabric.js from CDN"));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
