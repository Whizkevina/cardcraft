import type { Template } from "@shared/schema";

const ACCENT_MAP: Record<string, { shape: "circle" | "square" }> = {
  "#2d0a5e": { shape: "circle" },
  "#FF6B6B": { shape: "circle" },
  "#FAFAF8": { shape: "square" },
  "#0a1628": { shape: "circle" },
  "#4a1942": { shape: "circle" },
  "#0f2744": { shape: "square" },
  "#7b3f6e": { shape: "circle" },
  "#5c1a00": { shape: "square" },
  "#0d4a2e": { shape: "circle" },
  "#6b0f2b": { shape: "circle" },
  "#1a4a7a": { shape: "circle" },
  "#7a3a00": { shape: "square" },
  "#1c3a5c": { shape: "circle" },
  "#1a1a2e": { shape: "circle" },
  "#8b0000": { shape: "circle" },
  "#7a2060": { shape: "circle" },
  "#0a2a4a": { shape: "circle" },
  "#0a0a1a": { shape: "circle" },
  "#0d3b1e": { shape: "circle" },
  "#1a2a1a": { shape: "circle" },
  "#210313": { shape: "circle" },
  "#ffebef": { shape: "circle" },
};

const PREVIEW_THEME_CLASSES: Record<string, { bg: string; accent: string; border: string; fill: string }> = {
  "#2d0a5e": { bg: "bg-[#1a0533]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]" },
  "#FF6B6B": { bg: "bg-[#FF6B6B]", accent: "text-[#FFFFFF]", border: "border-[#FFFFFF]", fill: "bg-[#FFFFFF]" },
  "#FAFAF8": { bg: "bg-[#FAFAF8]", accent: "text-[#2D2D2D]", border: "border-[#2D2D2D]", fill: "bg-[#2D2D2D]" },
  "#0a1628": { bg: "bg-[#0a1628]", accent: "text-[#D4AF37]", border: "border-[#D4AF37]", fill: "bg-[#D4AF37]" },
  "#4a1942": { bg: "bg-[#4a1942]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]" },
  "#0f2744": { bg: "bg-[#0f2744]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]" },
  "#7b3f6e": { bg: "bg-[#7b3f6e]", accent: "text-[#FFB6C1]", border: "border-[#FFB6C1]", fill: "bg-[#FFB6C1]" },
  "#5c1a00": { bg: "bg-[#2a0800]", accent: "text-[#f09820]", border: "border-[#f09820]", fill: "bg-[#f09820]" },
  "#0d4a2e": { bg: "bg-[#0d4a2e]", accent: "text-[#D4AF37]", border: "border-[#D4AF37]", fill: "bg-[#D4AF37]" },
  "#6b0f2b": { bg: "bg-[#6b0f2b]", accent: "text-[#FFB6C1]", border: "border-[#FFB6C1]", fill: "bg-[#FFB6C1]" },
  "#1a4a7a": { bg: "bg-[#1a4a7a]", accent: "text-[#FFFFFF]", border: "border-[#FFFFFF]", fill: "bg-[#FFFFFF]" },
  "#7a3a00": { bg: "bg-[#FFF8F0]", accent: "text-[#7a3a00]", border: "border-[#7a3a00]", fill: "bg-[#7a3a00]" },
  "#1c3a5c": { bg: "bg-[#1c3a5c]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]" },
  "#1a1a2e": { bg: "bg-[#1a1a2e]", accent: "text-[#e8b800]", border: "border-[#e8b800]", fill: "bg-[#e8b800]" },
  "#8b0000": { bg: "bg-[#1a0000]", accent: "text-[#FF6B6B]", border: "border-[#FF6B6B]", fill: "bg-[#FF6B6B]" },
  "#7a2060": { bg: "bg-[#FDF0F8]", accent: "text-[#7a2060]", border: "border-[#7a2060]", fill: "bg-[#7a2060]" },
  "#0a2a4a": { bg: "bg-[#0a2a4a]", accent: "text-[#C9A84C]", border: "border-[#C9A84C]", fill: "bg-[#C9A84C]" },
  "#0a0a1a": { bg: "bg-[#0a0a1a]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]" },
  "#0d3b1e": { bg: "bg-[#0d3b1e]", accent: "text-[#FF4444]", border: "border-[#FF4444]", fill: "bg-[#FF4444]" },
  "#1a2a1a": { bg: "bg-[#FFFFFF]", accent: "text-[#4CAF50]", border: "border-[#4CAF50]", fill: "bg-[#4CAF50]" },
  "#210313": { bg: "bg-[#210313]", accent: "text-[#FFD700]", border: "border-[#FFD700]", fill: "bg-[#FFD700]" },
  "#ffebef": { bg: "bg-[#ffebef]", accent: "text-[#ff3366]", border: "border-[#ff668a]", fill: "bg-[#ff3366]" },
};

const getPreviewTheme = (thumbnailColor: string) =>
  PREVIEW_THEME_CLASSES[thumbnailColor] || {
    bg: "bg-secondary",
    accent: "text-white",
    border: "border-white",
    fill: "bg-white",
  };

interface TemplateMockPreviewProps {
  template: Pick<Template, "thumbnailColor">;
  compact?: boolean;
}

/** Geometric placeholder when preview_image is not yet generated */
export function TemplateMockPreview({ template, compact = false }: TemplateMockPreviewProps) {
  const style = ACCENT_MAP[template.thumbnailColor] || { shape: "circle" as const };
  const theme = getPreviewTheme(template.thumbnailColor);
  const top = compact ? "top-4" : "top-6";
  const frameSize = compact ? "w-14 h-14" : "w-20 h-20";
  const iconSize = compact ? "w-7 h-7" : "w-9 h-9";

  return (
    <div className={`absolute inset-0 ${theme.bg}`}>
      {style.shape === "circle" ? (
        <div className={`absolute ${top} left-1/2 -translate-x-1/2 ${frameSize} rounded-full border-2 flex items-center justify-center`}>
          <div className={`absolute inset-0 rounded-full border-2 opacity-65 ${theme.border}`} />
          <div className={`absolute inset-0 rounded-full ${theme.fill} opacity-10`} />
          <svg viewBox="0 0 24 24" fill="none" className={`relative z-10 ${iconSize} ${theme.accent} opacity-45`}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      ) : (
        <div className={`absolute ${top} left-6 w-16 h-16 border-2 flex items-center justify-center ${theme.border}`}>
          <svg viewBox="0 0 24 24" fill="none" className={`w-8 h-8 ${theme.accent} opacity-40`}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </div>
      )}

      <div className={`absolute ${compact ? "bottom-6" : "bottom-8"} left-0 right-0 ${style.shape === "circle" ? "text-center space-y-1.5 px-4" : "left-4 right-2 space-y-1.5"}`}>
        <div className={`h-2.5 rounded-full ${style.shape === "circle" ? "mx-auto w-[55%]" : "w-[70%]"} ${theme.fill} opacity-80`} />
        <div className={`h-3 rounded-full ${style.shape === "circle" ? "mx-auto w-[72%]" : "w-[50%]"} ${theme.fill} opacity-95`} />
        <div className={`h-2 rounded-full ${style.shape === "circle" ? "mx-auto w-[40%]" : "w-[38%]"} ${theme.fill} opacity-50`} />
      </div>
    </div>
  );
}

export { getPreviewTheme, PREVIEW_THEME_CLASSES };
