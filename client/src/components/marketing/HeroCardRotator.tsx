import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Template } from "@shared/schema";
import { TemplateThumbnail } from "@/components/TemplateThumbnail";
import { cn } from "@/lib/utils";

const ROTATE_MS = 4500;
const TRANSITION_MS = 650;

function pickRandomIndex(length: number, exclude: number): number {
  if (length <= 1) return 0;
  let next = exclude;
  while (next === exclude) next = Math.floor(Math.random() * length);
  return next;
}

interface HeroCardRotatorProps {
  templates: Template[];
  showCaption?: boolean;
}

export function HeroCardRotator({ templates, showCaption = true }: HeroCardRotatorProps) {
  const pool = useMemo(
    () => templates.filter((t) => t.previewImage || t.thumbnailColor),
    [templates],
  );

  const [index, setIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [titleVisible, setTitleVisible] = useState(true);
  const reducedMotion = useRef(
    typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const advance = useCallback(() => {
    if (pool.length <= 1) return;
    setTitleVisible(false);
    setIndex((prev) => {
      setLeavingIndex(prev);
      return pickRandomIndex(pool.length, prev);
    });
    window.setTimeout(() => {
      setLeavingIndex(null);
      setTitleVisible(true);
    }, TRANSITION_MS);
  }, [pool.length]);

  useEffect(() => {
    if (pool.length <= 1 || reducedMotion.current) return;
    const id = window.setInterval(advance, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [advance, pool.length]);

  useEffect(() => {
    for (const t of pool) {
      if (!t.previewImage) continue;
      const img = new Image();
      img.src = t.previewImage;
    }
  }, [pool]);

  const current = pool[index];
  const leaving = leavingIndex !== null ? pool[leavingIndex] : null;

  if (!current) {
    return (
      <>
        <div className="aspect-[4/5] rounded-xl bg-[#1a0533] relative overflow-hidden border border-[#FFD700]/30">
          <div className="absolute inset-4 border border-[#FFD700]/40 rounded-lg" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="text-[#FFD700] text-sm tracking-wide">Happy Birthday</p>
            <p className="text-white text-2xl font-bold font-display">Your Name</p>
            <p className="text-[#FFD700]/80 text-xs">April 15, 2026</p>
            <p className="text-white/60 text-xs italic mt-2">Celebrating a life well lived</p>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">Royal Elegance — fully customizable</p>
      </>
    );
  }

  return (
    <>
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
        {leaving ? (
          <div className="absolute inset-0 hero-card-exit pointer-events-none" aria-hidden>
            <TemplateThumbnail template={leaving} className="rounded-xl h-full w-full" eager />
          </div>
        ) : null}
        <div
          key={current.id}
          className={cn(
            "absolute inset-0",
            leaving ? "hero-card-enter" : index === 0 ? "hero-card-enter-initial" : "hero-card-enter",
          )}
        >
          <TemplateThumbnail template={current} className="rounded-xl h-full w-full" eager />
        </div>
      </div>
      <p
        className={cn(
          "text-center text-xs text-muted-foreground mt-3 transition-opacity duration-300",
          titleVisible ? "opacity-100" : "opacity-0",
          !showCaption && "sr-only",
        )}
        aria-live={showCaption ? "polite" : "off"}
      >
        {current.title} — fully customizable
      </p>
    </>
  );
}
