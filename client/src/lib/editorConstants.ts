export const EDITOR_FONTS = [
  "Georgia", "Arial", "Times New Roman", "Trebuchet MS", "Verdana", "Impact",
  "Great Vibes", "Courier New", "Tahoma", "Palatino", "Comic Sans MS", "Oswald",
  "Lucida Console", "Garamond",
];

export const FONT_PREVIEW_CLASSES: Record<string, string> = {
  Georgia: "font-preview-georgia",
  Arial: "font-preview-arial",
  "Times New Roman": "font-preview-times",
  "Trebuchet MS": "font-preview-trebuchet",
  Verdana: "font-preview-verdana",
  Impact: "font-preview-impact",
  "Great Vibes": "font-preview-great-vibes",
  "Courier New": "font-preview-courier",
  Tahoma: "font-preview-tahoma",
  Palatino: "font-preview-palatino",
  "Comic Sans MS": "font-preview-comic",
  Oswald: "font-preview-oswald",
  "Lucida Console": "font-preview-lucida",
  Garamond: "font-preview-garamond",
};

export const fontPreviewClass = (font: string) => FONT_PREVIEW_CLASSES[font] || "font-preview-default";

export const swatchDataUri = (color: string) =>
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" rx="3" fill="${color}"/></svg>`)}`;

export const BG_PRESETS = [
  { label: "Royal Purple", value: "#1a0533" },
  { label: "Midnight Blue", value: "#0a1628" },
  { label: "Coral", value: "#FF6B6B" },
  { label: "Forest", value: "#1B4332" },
  { label: "Rose Gold", value: "#c0a080" },
  { label: "Pearl White", value: "#FAFAF8" },
  { label: "Charcoal", value: "#2D2D2D" },
  { label: "Sky Blue", value: "#87CEEB" },
  { label: "Plum", value: "#4a1942" },
  { label: "Navy", value: "#0f2744" },
  { label: "Floral Pink", value: "#fdf6f0" },
  { label: "Olive", value: "#3d4f1c" },
];

export const EMOJI_PRESETS = ["❤️", "✨", "🎉", "🔥", "🎂", "🎈", "👑", "💍", "🕊️", "🥂"];

export type EditorPanelTab = "style" | "text" | "export";
export type MobileEditorPanel = "tools" | "layers" | "edit" | "export";
