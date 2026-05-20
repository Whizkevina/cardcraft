import type { ReactNode } from "react";
import type { Template } from "@shared/schema";
import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateMockPreview } from "./TemplateMockPreview";

interface TemplateThumbnailProps {
  template: Template;
  className?: string;
  imageClassName?: string;
  showCategory?: boolean;
  showProBadge?: boolean;
  locked?: boolean;
  compact?: boolean;
  eager?: boolean;
  hoverOverlay?: ReactNode;
}

export function TemplateThumbnail({
  template,
  className,
  imageClassName,
  showCategory = false,
  showProBadge = false,
  locked = false,
  compact = false,
  eager = false,
  hoverOverlay,
}: TemplateThumbnailProps) {
  return (
    <div className={cn("aspect-[4/5] relative overflow-hidden bg-secondary", className)}>
      {template.previewImage ? (
        <img
          src={template.previewImage}
          alt={template.title}
          className={cn("w-full h-full object-cover object-top", imageClassName)}
          loading={eager ? "eager" : "lazy"}
        />
      ) : (
        <TemplateMockPreview template={template} compact={compact} />
      )}

      {hoverOverlay}

      {showCategory ? (
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize border bg-black/40 text-white border-white/20 backdrop-blur-sm">
          {template.category}
        </div>
      ) : null}

      {showProBadge && template.isPro ? (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/90 text-primary-foreground flex items-center gap-0.5">
          <Crown size={9} /> PRO
        </div>
      ) : null}

      {locked ? (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Lock size={20} className="text-white" />
        </div>
      ) : null}
    </div>
  );
}
