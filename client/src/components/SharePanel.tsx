/**
 * SharePanel — social sharing and export controls
 * Handles: WhatsApp share, copy image, copy link, watermark injection, download gating
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "./AuthProvider";
import { apiRequest } from "@/lib/queryClient";
import { Download, Share2, Copy, Link, Sparkles, Lock, QrCode, Mail, Loader2 } from "lucide-react";

const EXPORT_PRESETS = [
  { label: "Original (800×1000)", multiplier: 2 },
  { label: "Square Social (1080×1080)", multiplier: 2.7 },
  { label: "Portrait Story (1080×1920)", multiplier: 2.7 },
  { label: "Portrait Flyer (1200×1500)", multiplier: 3 },
];

interface SharePanelProps {
  fabricRef: React.RefObject<any>;
  projectTitle: string;
  projectId?: number | null;
  onQROpen: () => void;
}

const FREE_LIMIT = 3;

export function SharePanel({ fabricRef, projectTitle, projectId, onQROpen }: SharePanelProps) {
  const { user, isPro } = useAuth();
  const { toast } = useToast();
  const [preset, setPreset] = useState(EXPORT_PRESETS[0]);
  const [sharing, setSharing] = useState(false);

  // Check download permission
  const checkAndTrack = async (): Promise<boolean> => {
    try {
      const res = await apiRequest("POST", "/api/downloads/track");
      const data = await res.json();
      if (!data.allowed) {
        toast({
          title: "Daily limit reached",
          description: `Free accounts can download ${FREE_LIMIT} cards per day. Ask your admin to upgrade your account to Pro for unlimited downloads.`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    } catch {
      return true; // Fail open — don't block on network error
    }
  };

  // Apply watermark to canvas for free/guest users
  const applyWatermark = (canvas: any, f: any) => {
    if (isPro) return null; // Pro users — no watermark
    const wm = new f.Text("CardCraft", {
      left: canvas.width - 8,
      top: canvas.height - 8,
      originX: "right",
      originY: "bottom",
      fontSize: Math.round(canvas.width * 0.025),
      fontFamily: "Arial",
      fill: "rgba(255,255,255,0.35)",
      selectable: false,
      evented: false,
      _watermark: true,
    });
    canvas.add(wm);
    canvas.renderAll();
    return wm;
  };

  const removeWatermark = (canvas: any, wm: any) => {
    if (wm) { canvas.remove(wm); canvas.renderAll(); }
  };

  // Export to data URL (with optional watermark)
  const getExportDataURL = (format: "png" | "jpeg"): string | null => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    const f = (window as any).fabric;
    const currentZoom = canvas.getZoom();
    canvas.setZoom(1);
    const wm = applyWatermark(canvas, f);
    const dataURL = canvas.toDataURL({ format, quality: 0.95, multiplier: preset.multiplier });
    removeWatermark(canvas, wm);
    canvas.setZoom(currentZoom);
    return dataURL;
  };

  // Download as file
  const downloadCard = async (format: "png" | "jpeg") => {
    const allowed = await checkAndTrack();
    if (!allowed) return;

    const dataURL = getExportDataURL(format);
    if (!dataURL) return;

    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `${projectTitle.replace(/\s+/g, "-")}.${format === "jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const remaining = user && !isPro ? `${FREE_LIMIT - ((user.downloadsToday || 0) + 1)} free downloads remaining today` : "";
    toast({ title: "Downloaded!", description: remaining || `${format.toUpperCase()} exported.` });
  };

  // Copy image to clipboard
  const copyImage = async () => {
    if (!navigator.clipboard) {
      toast({ title: "Not supported", description: "Clipboard API not available in this browser.", variant: "destructive" });
      return;
    }
    const dataURL = getExportDataURL("png");
    if (!dataURL) return;
    try {
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast({ title: "Copied!", description: "Image copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Try downloading instead.", variant: "destructive" });
    }
  };

  // Share to WhatsApp
  const shareWhatsApp = async () => {
    setSharing(true);
    try {
      const dataURL = getExportDataURL("jpeg");
      if (!dataURL) return;

      // On mobile, use Web Share API if available
      if (navigator.share) {
        const res = await fetch(dataURL);
        const blob = await res.blob();
        const file = new File([blob], `${projectTitle}.jpg`, { type: "image/jpeg" });
        await navigator.share({ files: [file], title: projectTitle });
        toast({ title: "Shared!" });
      } else {
        // Desktop: download + open WhatsApp Web
        const a = document.createElement("a");
        a.href = dataURL;
        a.download = `${projectTitle.replace(/\s+/g, "-")}.jpg`;
        a.click();
        setTimeout(() => {
          window.open("https://web.whatsapp.com", "_blank", "noopener,noreferrer");
        }, 800);
        toast({ title: "Card downloaded", description: "Share the file in WhatsApp Web that just opened." });
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast({ title: "Share failed", description: e.message, variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  };

  // Copy shareable link — public /share/:id if saved, else editor URL
  const copyLink = async () => {
    const base = window.location.origin + window.location.pathname.replace(/index\.html$/, "");
    const url = projectId
      ? `${base}#/share/${projectId}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: projectId ? "Anyone can view this card via the link." : "Share this link to open the card in the editor." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const downloadsLeft = user && !isPro
    ? Math.max(0, FREE_LIMIT - (user.downloadsToday || 0))
    : null;

  return (
    <div className="space-y-4">
      {/* Tier status */}
      {user && !isPro && (
        <div className="bg-secondary rounded-lg p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-foreground">Free Account</span>
            <span className={`font-bold ${downloadsLeft === 0 ? "text-destructive" : "text-gold"}`}>
              {downloadsLeft}/3 left today
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${((3 - (downloadsLeft ?? 0)) / 3) * 100}%` }}
            />
          </div>
          <p className="text-muted-foreground">Ask your admin to upgrade your account for unlimited downloads.</p>
        </div>
      )}

      {isPro && (
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2 text-xs">
          <Sparkles size={12} className="text-primary" />
          <span className="text-primary font-medium">Pro Account — unlimited downloads, no watermark</span>
        </div>
      )}

      {/* Export preset */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Export Size</Label>
        <Select value={preset.label} onValueChange={v => setPreset(EXPORT_PRESETS.find(p => p.label === v) || EXPORT_PRESETS[0])}>
          <SelectTrigger className="h-8 text-xs" data-testid="select-export-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPORT_PRESETS.map(p => <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Download buttons */}
      <div className="space-y-2">
        <Button
          className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs"
          onClick={() => downloadCard("png")} data-testid="button-download-png"
        >
          <Download size={13} /> Download PNG
          {!isPro && <span className="ml-auto text-primary-foreground/60 text-[10px]">+watermark</span>}
        </Button>
        <Button
          variant="outline" className="w-full gap-2 h-9 text-xs"
          onClick={() => downloadCard("jpeg")} data-testid="button-download-jpg"
        >
          <Download size={13} /> Download JPG
          {!isPro && <span className="ml-auto text-muted-foreground text-[10px]">+watermark</span>}
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">Share</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Share actions */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={shareWhatsApp}
          disabled={sharing}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-share-whatsapp"
        >
          {/* WhatsApp icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current text-green-500">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          WhatsApp
        </button>

        <button
          onClick={copyImage}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-copy-image"
        >
          <Copy size={18} className="text-blue-400" />
          Copy Image
        </button>

        <button
          onClick={copyLink}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-secondary hover:bg-secondary/70 transition-colors text-xs text-muted-foreground hover:text-foreground"
          data-testid="button-copy-link"
        >
          <Link size={18} className="text-primary" />
          Copy Link
        </button>
      </div>

      {/* Send by email */}
      <EmailSendSection fabricRef={fabricRef} projectTitle={projectTitle} isPro={isPro} />

      {/* QR Code button */}
      <button
        onClick={onQROpen}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/70 transition-colors text-xs text-muted-foreground hover:text-foreground"
        data-testid="button-open-qr"
      >
        <QrCode size={14} className="text-gold" />
        <div className="text-left">
          <p className="font-medium text-foreground text-xs">Add QR Code</p>
          <p className="text-[10px] text-muted-foreground">Place a scannable QR code on the card</p>
        </div>
      </button>
    </div>
  );
}


// ─── Email send section ───────────────────────────────────────────────────────
function EmailSendSection({ fabricRef, projectTitle, isPro }: { fabricRef: any; projectTitle: string; isPro: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle"|"success"|"error">("idle");
  const { toast } = useToast();

  const sendByEmail = async () => {
    if (!email) { toast({ title: "Enter recipient email", variant: "destructive" }); return; }
    const canvas = fabricRef.current;
    if (!canvas) return;
    setSending(true);
    setEmailStatus("idle");
    try {
      const f = (window as any).fabric;
      const currentZoom = canvas.getZoom();
      canvas.setZoom(1);
      // Apply watermark for free users
      let wm: any = null;
      if (!isPro) {
        wm = new f.Text("CardCraft", {
          left: canvas.width - 8, top: canvas.height - 8,
          originX: "right", originY: "bottom",
          fontSize: Math.round(canvas.width * 0.025), fontFamily: "Arial",
          fill: "rgba(255,255,255,0.35)", selectable: false, evented: false,
        });
        canvas.add(wm); canvas.renderAll();
      }
      const dataURL = canvas.toDataURL({ format: "jpeg", quality: 0.92, multiplier: 2 });
      if (wm) { canvas.remove(wm); canvas.renderAll(); }
      canvas.setZoom(currentZoom);

      const res = await fetch("/api/email/send-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email, message, imageDataUrl: dataURL, cardTitle: projectTitle }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        if (data.hint) {
          setEmailStatus("error");
          toast({ title: "Email not configured", description: data.hint, variant: "destructive" });
        } else {
          throw new Error(data.error);
        }
      } else {
        setEmailStatus("success");
        toast({ title: "Card sent!", description: 'Delivered to ' + email });
        setEmail(""); setMessage("");
      }
    } catch (e: any) {
      setEmailStatus("error");
      toast({ title: "Failed to send", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground flex items-center gap-1"><Mail size={10} /> Send by Email</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <Input
        type="email" placeholder="recipient@email.com" value={email}
        onChange={e => setEmail(e.target.value)}
        className="h-8 text-xs" data-testid="input-email-recipient"
      />
      <Input
        placeholder="Add a personal message (optional)" value={message}
        onChange={e => setMessage(e.target.value)}
        className="h-8 text-xs"
      />
      <button
        onClick={sendByEmail} disabled={sending || !email}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary hover:bg-secondary/70 disabled:opacity-50 transition-colors text-xs font-medium"
        data-testid="button-send-email"
      >
        {sending
          ? <><Loader2 size={12} className="animate-spin" /> Sending...</>
          : <><Mail size={12} className="text-primary" /> Send Card by Email</>
        }
      </button>
      {emailStatus === "success" && <p className="text-xs text-green-500 text-center">✓ Card delivered successfully</p>}
    </div>
  );
}
