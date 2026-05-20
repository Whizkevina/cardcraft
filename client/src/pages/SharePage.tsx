import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft, Loader2 } from "lucide-react";
import { useFabric } from "@/hooks/useFabric";
import { loadDesignJson } from "@/lib/loadDesignJson";

const MAX_W = 480;
const MAX_H = 600;

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const layoutRef = useRef<{ srcWidth: number; srcHeight: number } | null>(null);
  const { fabricLoaded } = useFabric();
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  const { data: card, isLoading, isError } = useQuery({
    queryKey: ["/api/share", token],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/share/${token}`);
      if (!res.ok) throw new Error("Card not found");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (card?.shareImage || card?.thumbnail) {
      setRendered(true);
      setRenderError(false);
    }
  }, [card?.shareImage, card?.thumbnail]);

  useEffect(() => {
    if (!fabricLoaded || !card || card.shareImage || card.thumbnail || !canvasRef.current) return;

    let cancelled = false;
    setRendered(false);
    setRenderError(false);

    const renderLegacy = async () => {
      try {
        const f = (window as any).fabric;
        if (!f || !canvasRef.current) return;

        if (fabricRef.current) {
          fabricRef.current.dispose();
          fabricRef.current = null;
        }

        const canvas = new f.Canvas(canvasRef.current, {
          preserveObjectStacking: true,
          selection: false,
          interactive: false,
        });
        fabricRef.current = canvas;

        const layout = await loadDesignJson(canvas, card.designJson, {
          interactive: false,
          maxWidth: MAX_W,
          maxHeight: MAX_H,
        });

        if (cancelled) return;
        layoutRef.current = { srcWidth: layout.srcWidth, srcHeight: layout.srcHeight };
        setRendered(true);
      } catch (e) {
        console.error("Failed to render shared card", e);
        if (!cancelled) {
          setRenderError(true);
          setRendered(true);
        }
      }
    };

    renderLegacy();

    return () => {
      cancelled = true;
      fabricRef.current?.dispose();
      fabricRef.current = null;
      layoutRef.current = null;
    };
  }, [fabricLoaded, card]);

  const handleDownload = () => {
    if (card?.shareImage) {
      const a = document.createElement("a");
      a.href = card.shareImage;
      a.download = `${(card.title || "card").replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (card?.thumbnail && !fabricRef.current) {
      const a = document.createElement("a");
      a.href = card.thumbnail;
      a.download = `${(card.title || "card").replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (!fabricRef.current) return;
    const layout = layoutRef.current;
    const multiplier = layout
      ? Math.max(2, layout.srcWidth / fabricRef.current.getWidth())
      : 2;

    const url = fabricRef.current.toDataURL({ format: "png", quality: 0.95, multiplier });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(card?.title || "card").replace(/\s+/g, "-")}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
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

            <div className="share-card-shadow rounded-sm overflow-hidden relative max-w-full">
              {card.shareImage ? (
                <img
                  src={card.shareImage}
                  alt={card.title}
                  className="max-w-full h-auto block"
                  data-testid="share-image"
                />
              ) : card.thumbnail ? (
                <img
                  src={card.thumbnail}
                  alt={card.title}
                  className="max-w-full h-auto block"
                  data-testid="share-thumbnail"
                />
              ) : (
                <>
                  <canvas ref={canvasRef} data-testid="share-canvas" />
                  {!rendered && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                      <Loader2 size={24} className="animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {renderError && rendered && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-4 text-center">
                      <p className="text-sm text-muted-foreground">Could not render this card preview.</p>
                    </div>
                  )}
                </>
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
