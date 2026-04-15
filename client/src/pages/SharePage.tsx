import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Loader2 } from "lucide-react";

// Shared canvas dimensions matching Editor
let CANVAS_W = 400;
let CANVAS_H = 500;
let SRC_W = 800;
let SRC_H = 1000;
const MAX_W = 480;
const MAX_H = 600;

export default function SharePage() {
  const { id } = useParams<{ id: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [rendered, setRendered] = useState(false);

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ["/api/projects/share", id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${id}/share`);
      if (!res.ok) throw new Error("Card not found");
      return res.json();
    },
    enabled: !!id,
    retry: false,
  });

  // Load Fabric.js
  useEffect(() => {
    if ((window as any).fabric) { setFabricLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js";
    script.onload = () => setFabricLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Render canvas from designJson
  useEffect(() => {
    if (!fabricLoaded || !card || !canvasRef.current || fabricRef.current) return;
    const f = (window as any).fabric;
    try {
      const data = JSON.parse(card.designJson);
      const srcW = data.canvasWidth || data.objects?.[0]?.canvasWidth || 800;
      const srcH = data.canvasHeight || data.objects?.[0]?.canvasHeight || 1000;
      SRC_W = srcW; SRC_H = srcH;

      const aspect = srcW / srcH;
      if (aspect >= 1) { CANVAS_W = MAX_W; CANVAS_H = Math.round(MAX_W / aspect); }
      else { CANVAS_H = MAX_H; CANVAS_W = Math.round(MAX_H * aspect); }

      const canvas = new f.Canvas(canvasRef.current, {
        width: CANVAS_W,
        height: CANVAS_H,
        preserveObjectStacking: true,
        selection: false,
        interactive: false,
      });
      fabricRef.current = canvas;

      const scaleX = CANVAS_W / srcW;
      const scaleY = CANVAS_H / srcH;

      if (data.background) canvas.setBackgroundColor(data.background, canvas.renderAll.bind(canvas));

      const buildGradient = (gradDef: any, objW: number, objH: number) => {
        if (!gradDef || !f.Gradient) return null;
        try {
          const stops = (gradDef.colorStops || []).map((cs: any) => ({ offset: cs.offset, color: cs.color }));
          if (gradDef.type === "radial") {
            return new f.Gradient({ type: "radial", coords: {
              x1: (gradDef.coords?.x1 ?? 0.5) * objW, y1: (gradDef.coords?.y1 ?? 0.5) * objH,
              x2: (gradDef.coords?.x2 ?? 0.5) * objW, y2: (gradDef.coords?.y2 ?? 0.5) * objH,
              r1: (gradDef.coords?.r1 ?? 0) * Math.max(objW, objH),
              r2: (gradDef.coords?.r2 ?? 1) * Math.max(objW, objH),
            }, colorStops: stops });
          }
          return new f.Gradient({ type: "linear", coords: {
            x1: (gradDef.coords?.x1 ?? 0) * objW, y1: (gradDef.coords?.y1 ?? 0) * objH,
            x2: (gradDef.coords?.x2 ?? 1) * objW, y2: (gradDef.coords?.y2 ?? 0) * objH,
          }, colorStops: stops });
        } catch { return null; }
      };

      (data.objects || []).forEach((obj: any) => {
        const objW = (obj.width || (obj.radius || 50) * 2) * scaleX;
        const objH = (obj.height || (obj.radius || 50) * 2) * scaleY;
        const s: any = {
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
          scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1,
          selectable: false, evented: false,
        };
        if (obj.fillGradient) s.fill = buildGradient(obj.fillGradient, objW, objH);

        if (obj.type === "rect") canvas.add(new f.Rect(s));
        else if (obj.type === "circle") canvas.add(new f.Circle(s));
        else if (obj.type === "text" || obj.type === "i-text") {
          const textS = { ...s };
          if (obj.fillGradient) textS.fill = obj.fillGradient.colorStops?.[1]?.color || "#f09820";
          const textObj = new f.IText(obj.text, { ...textS, type: undefined });
          canvas.add(textObj);
          if (obj.fillGradient) {
            setTimeout(() => {
              const tw = textObj.width || 300;
              const th = textObj.height || 60;
              const tg = buildGradient(obj.fillGradient, tw, th);
              if (tg) { textObj.set("fill", tg); canvas.renderAll(); }
            }, 50);
          }
        } else if (obj.type === "image" && obj.src) {
          f.Image.fromURL(obj.src, (img: any) => {
            img.set({ left: s.left, top: s.top, scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1, selectable: false, evented: false });
            canvas.add(img);
            canvas.renderAll();
          }, { crossOrigin: "anonymous" });
        }
      });
      canvas.renderAll();
      setTimeout(() => setRendered(true), 300);
    } catch (e) {
      console.error("Failed to render shared card", e);
      setRendered(true);
    }
  }, [fabricLoaded, card]);

  const handleDownload = () => {
    if (!fabricRef.current) return;
    const url = fabricRef.current.toDataURL({ format: "png", quality: 0.95, multiplier: 2 });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(card?.title || "card").replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={15} /> CardCraft
        </Link>
        {rendered && card && (
          <Button size="sm" onClick={handleDownload} className="gap-1.5 text-xs h-8">
            <Download size={13} /> Download
          </Button>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        {isLoading && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Loading card…</p>
          </div>
        )}

        {isError && (
          <div className="text-center space-y-3">
            <p className="text-lg font-semibold">Card not found</p>
            <p className="text-sm text-muted-foreground">This link may have expired or the card doesn't exist.</p>
            <Link href="/templates">
              <Button variant="outline" size="sm">Browse Templates</Button>
            </Link>
          </div>
        )}

        {card && (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-lg font-bold">{card.title}</h1>
              <p className="text-xs text-muted-foreground">Designed with CardCraft</p>
            </div>

            <div className="shadow-2xl rounded-sm overflow-hidden relative">
              <canvas ref={canvasRef} />
              {!rendered && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                  <Loader2 size={24} className="animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button onClick={handleDownload} className="gap-1.5" disabled={!rendered}>
                <Download size={14} /> Download PNG
              </Button>
              <Link href="/templates">
                <Button variant="outline" className="gap-1.5 text-xs">
                  Create Your Own
                </Button>
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
