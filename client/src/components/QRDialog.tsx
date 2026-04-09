/**
 * QRDialog — generates a QR code and places it on the Fabric canvas as an image layer
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Loader2, Plus } from "lucide-react";

interface QRDialogProps {
  open: boolean;
  onClose: () => void;
  fabricRef: React.RefObject<any>;
}

const QR_PRESETS = [
  { label: "Website URL", placeholder: "https://example.com" },
  { label: "Phone Number", placeholder: "tel:+2348012345678" },
  { label: "WhatsApp Message", placeholder: "https://wa.me/2348012345678" },
  { label: "Email", placeholder: "mailto:you@example.com" },
  { label: "Custom Text", placeholder: "Any text or link" },
];

const QR_SIZES = [
  { label: "Small (80px)", value: 80 },
  { label: "Medium (120px)", value: 120 },
  { label: "Large (160px)", value: 160 },
];

const QR_COLORS = [
  { label: "Black on White", fg: "#000000", bg: "#FFFFFF" },
  { label: "White on Dark", fg: "#FFFFFF", bg: "#1a0533" },
  { label: "Gold on Dark", fg: "#FFD700", bg: "#1a0533" },
  { label: "Dark on Gold", fg: "#1a0533", bg: "#FFD700" },
];

export function QRDialog({ open, onClose, fabricRef }: QRDialogProps) {
  const { toast } = useToast();
  const [qrValue, setQrValue] = useState("https://");
  const [size, setSize] = useState(120);
  const [colors, setColors] = useState(QR_COLORS[0]);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const generateQR = async () => {
    if (!qrValue || qrValue.length < 3) {
      toast({ title: "Enter a URL or text", variant: "destructive" }); return;
    }
    setGenerating(true);
    try {
      // Dynamically import qrcode
      const QRCode = await import("qrcode");
      const dataURL = await QRCode.toDataURL(qrValue, {
        width: size * 3, // Generate at 3x for sharpness
        margin: 1,
        color: { dark: colors.fg, light: colors.bg },
        errorCorrectionLevel: "M",
      });
      setPreview(dataURL);
    } catch (e: any) {
      toast({ title: "QR generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const addToCanvas = () => {
    if (!preview || !fabricRef.current) return;
    const f = (window as any).fabric;
    const canvas = fabricRef.current;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = size / img.width;
      const fabricImg = new f.Image(img, {
        left: canvas.width / 2 - size / 2,
        top: canvas.height / 2 - size / 2,
        scaleX: scale,
        scaleY: scale,
        customType: "qr_code",
        editable: true,
        movable: true,
      });
      canvas.add(fabricImg);
      canvas.setActiveObject(fabricImg);
      canvas.renderAll();
      toast({ title: "QR code added!", description: "Drag it to position on your card." });
      onClose();
    };
    img.onerror = () => toast({ title: "Failed to add QR", variant: "destructive" });
    img.src = preview;
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode size={16} className="text-gold" /> Add QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* URL / Text input */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Link or Text</Label>
            <Input
              value={qrValue}
              onChange={e => { setQrValue(e.target.value); setPreview(null); }}
              placeholder="https://your-website.com"
              className="text-sm h-9"
              data-testid="input-qr-value"
            />
            {/* Quick presets */}
            <div className="flex gap-1.5 flex-wrap">
              {QR_PRESETS.slice(0, 3).map(p => (
                <button key={p.label}
                  onClick={() => { setQrValue(p.placeholder); setPreview(null); }}
                  className="text-[10px] px-2 py-1 rounded bg-secondary hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <div className="flex gap-1.5">
                {QR_SIZES.map(s => (
                  <button key={s.value}
                    onClick={() => { setSize(s.value); setPreview(null); }}
                    className={`flex-1 py-1.5 rounded text-xs transition-colors ${size === s.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                    {s.label.split(" ")[0]}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Style</Label>
              <div className="grid grid-cols-2 gap-1">
                {QR_COLORS.map(c => (
                  <button key={c.label}
                    onClick={() => { setColors(c); setPreview(null); }}
                    className={`h-7 rounded text-[10px] font-medium border-2 transition-all ${colors === c ? "border-primary" : "border-transparent"}`}
                    style={{ background: c.bg, color: c.fg }}>
                    QR
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate button + preview */}
          <Button
            onClick={generateQR}
            disabled={generating || !qrValue}
            className="w-full gap-2 bg-secondary text-foreground hover:bg-secondary/70 border border-border h-9 text-xs"
            data-testid="button-generate-qr"
          >
            {generating ? <><Loader2 size={13} className="animate-spin" /> Generating...</> : <><QrCode size={13} /> Generate Preview</>}
          </Button>

          {preview && (
            <div className="space-y-3">
              <div className="flex justify-center p-4 bg-secondary rounded-lg border border-border">
                <img src={preview} alt="QR Code preview" className="rounded" style={{ width: size, height: size }} />
              </div>
              <Button
                onClick={addToCanvas}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs"
                data-testid="button-add-qr-to-canvas"
              >
                <Plus size={13} /> Add to Card
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
