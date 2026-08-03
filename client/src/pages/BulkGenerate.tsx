import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { colorSwatchDataUri } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { trackFeatureEvent } from "@/hooks/useTelemetry";
import { loadFabric } from "@/lib/loadFabric";
import { MarketingPageShell } from "@/components/marketing/MarketingPageShell";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { AppPageHeader } from "@/components/marketing/AppPageHeader";
import { SurfaceCard } from "@/components/marketing/SurfaceCard";
import { EmptyState } from "@/components/marketing/EmptyState";
import { hp, hpCn } from "@/components/marketing/homeTokens";
import { Upload, Download, Layers, FileText, CheckCircle, XCircle, Loader2, Play, Crown } from "lucide-react";
import type { Template } from "@shared/schema";

interface BulkRow {
  id: string;
  name: string;
  greeting: string;
  date: string;
  subtitle?: string;
  image?: string;
  status: "pending" | "generating" | "done" | "error";
  dataUrl?: string;
}

const SAMPLE_CSV = `name,greeting,date,subtitle
John Doe,Happy Birthday,April 15 2026,Wishing you a wonderful day
Jane Smith,Happy Birthday,April 20 2026,May all your dreams come true
Alex Johnson,Happy Birthday,May 1 2026,Celebrating you today
`;

export default function BulkGenerate() {
  const { user, isPro, isLoading: authLoading } = useAuth();
  const [templateId, setTemplateId] = useState<string>("");
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [generating, setGenerating] = useState(false);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/templates");
      return res.json();
    },
  });

  const parseCSV = (text: string): BulkRow[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
    return lines.slice(1).map((line, i) => {
      const values = line.split(",").map(v => v.trim());
      const row: any = { id: `row-${i}`, status: "pending" };
      headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
      return row as BulkRow;
    });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target?.result as string);
      if (parsed.length === 0) { toast({ title: "Invalid CSV", description: "Make sure CSV has headers: name, greeting, date, subtitle, image", variant: "destructive" }); return; }
      setRows(parsed);
      toast({ title: `${parsed.length} rows imported`, description: "Ready to generate cards." });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cardcraft-bulk-sample.csv";
    a.click();
  };

  const generateCard = async (row: BulkRow, template: Template): Promise<string> => {
    await loadFabric();
    const f = (window as any).fabric;

    return new Promise((resolve, reject) => {
      const data = JSON.parse(template.canvasJson);
      let w = 800;
      let h = 1000;
      if (data.canvasWidth) w = data.canvasWidth;
      if (data.canvasHeight) h = data.canvasHeight;

      const el = document.createElement("canvas");
      el.width = w;
      el.height = h;
      const canvas = new f.StaticCanvas(el, { width: w, height: h });

      if (data.objects) {
        data.objects = data.objects.map((obj: any) => {
          if (obj.customType === "name" && row.name) obj.text = row.name;
          if (obj.customType === "greeting" && row.greeting) obj.text = row.greeting;
          if (obj.customType === "date" && row.date) obj.text = row.date;
          if (obj.customType === "subtitle" && row.subtitle) obj.text = row.subtitle;
          return obj;
        });
      }

      canvas.loadFromJSON(data, async () => {
        const frameObj = canvas.getObjects().find((o: any) => o.customType === "photo_frame" || o.customType === "photo_image" || o.customType === "logo");

        if (frameObj) {
          const frameIndex = canvas.getObjects().indexOf(frameObj);

          if (row.image && row.image.startsWith("http")) {
            await new Promise<void>(res => {
              const imgElement = new Image();
              imgElement.crossOrigin = "anonymous";
              imgElement.onload = () => {
                const isCircle = frameObj.type === "circle" || (frameObj.rx && frameObj.rx >= (Math.min(frameObj.width || 100, frameObj.height || 100) / 2) * 0.9);
                let clipPath: any = null;
                const sizeW = frameObj.getScaledWidth();
                const sizeH = frameObj.getScaledHeight();

                if (isCircle) {
                  clipPath = new f.Circle({ radius: Math.min(sizeW, sizeH) / 2, originX: "center", originY: "center" });
                } else {
                  clipPath = new f.Rect({ width: sizeW, height: sizeH, rx: frameObj.rx || 0, ry: frameObj.ry || 0, originX: "center", originY: "center" });
                }

                const center = frameObj.getCenterPoint();
                const scale = Math.max(sizeW / imgElement.width, sizeH / imgElement.height);

                const fabricImg = new f.Image(imgElement, {
                  left: center.x,
                  top: center.y,
                  originX: "center",
                  originY: "center",
                  scaleX: scale,
                  scaleY: scale,
                  angle: frameObj.angle || 0,
                  clipPath,
                  customType: "photo_image"
                });

                if (frameObj.customType === "photo_image") canvas.remove(frameObj);
                canvas.add(fabricImg);
                fabricImg.moveTo(frameIndex);
                res();
              };
              imgElement.onerror = () => res();
              if (!row.image) return res();
              imgElement.src = row.image;
            });
          } else if (row.name) {
            const words = row.name.trim().split(" ");
            let initials = (words[0] ? words[0][0] : "").toUpperCase();
            if (words.length > 1) initials += (words[words.length - 1] ? words[words.length - 1][0] : "").toUpperCase();

            const center = frameObj.getCenterPoint();
            const sizeW = frameObj.getScaledWidth();
            const sizeH = frameObj.getScaledHeight();
            const size = Math.min(sizeW, sizeH);

            const textObj = new f.Text(initials, {
              left: center.x,
              top: center.y + (size * 0.05),
              originX: "center",
              originY: "center",
              fontSize: size * 0.45,
              fill: "#FFFFFF",
              fontFamily: "Inter, sans-serif",
              fontWeight: "600",
              textAlign: "center"
            });

            canvas.add(textObj);
            textObj.moveTo(frameIndex + 1);
          }
        }

        canvas.renderAll();
        setTimeout(() => {
          try {
            resolve(canvas.toDataURL({ format: "jpeg", quality: 1, multiplier: 2 }));
          } catch (e) {
            reject(e);
          }
          canvas.dispose();
        }, 100);
      });
    });
  };

  const generateAll = async () => {
    if (!templateId) { toast({ title: "Select a template", variant: "destructive" }); return; }
    if (rows.length === 0) { toast({ title: "Import a CSV first", variant: "destructive" }); return; }

    const template = templates.find(t => t.id === Number(templateId));
    if (!template) return;

    setGenerating(true);

    for (let i = 0; i < rows.length; i++) {
      setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "generating" } : r));
      try {
        const dataUrl = await generateCard(rows[i], template);
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", dataUrl } : r));
      } catch {
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: "error" } : r));
      }
    }

    setGenerating(false);
    toast({ title: "All cards generated!", description: "Download each card below." });
    trackFeatureEvent("bulk_generate", {
      pagePath: "/bulk",
      action: "generate_all",
      meta: { rowCount: rows.length, templateId: Number(templateId) },
    }).catch(() => {});
  };

  const downloadCard = (row: BulkRow) => {
    if (!row.dataUrl) return;
    const a = document.createElement("a");
    a.href = row.dataUrl;
    a.download = `${row.name.replace(/\s+/g, "-")}-card.jpg`;
    a.click();
  };

  const downloadAll = () => {
    const doneRows = rows.filter(r => r.status === "done" && r.dataUrl);
    doneRows.forEach((r, i) => {
      setTimeout(() => downloadCard(r), i * 300);
    });
    trackFeatureEvent("bulk_download", {
      pagePath: "/bulk",
      action: "download_all",
      meta: { count: doneRows.length },
    }).catch(() => {});
  };

  const doneCount = rows.filter(r => r.status === "done").length;

  if (authLoading) return null;

  if (!user || !isPro) {
    return (
      <MarketingPageShell>
        <MarketingSection spacing="default" containerClassName="max-w-lg mx-auto px-4 sm:px-6">
          <EmptyState
            icon={Layers}
            title="Pro feature"
            description="Bulk card generation is available on the Pro plan. Upgrade to generate personalized cards from CSV."
            actions={
              !user
                ? [{ label: "Sign In", href: "/auth" }]
                : [{ label: "Upgrade to Pro", href: "/pricing", icon: Crown }]
            }
          />
        </MarketingSection>
      </MarketingPageShell>
    );
  }

  return (
    <MarketingPageShell>
      <MarketingSection spacing="default" containerClassName="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <AppPageHeader
          eyebrow="Pro workflow"
          title="Generate cards in bulk"
          description="Upload a CSV with names and dates — CardCraft generates a personalized card for each row automatically."
        />

        <SurfaceCard variant="raised" className="p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={hpCn(hp.display, "text-lg text-gold/80 tabular-nums w-5 text-right shrink-0")}>01</span>
            <h2 className="font-semibold text-sm">Select template</h2>
          </div>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="max-w-xs h-10" data-testid="select-template">
              <SelectValue placeholder="Choose a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map(t => (
                <SelectItem key={t.id} value={String(t.id)}>
                  <span className="flex items-center gap-2">
                    {t.previewImage ? (
                      <img alt="" aria-hidden="true" src={t.previewImage} className="w-6 h-7 rounded object-cover object-top inline-block" />
                    ) : (
                      <img alt="" aria-hidden="true" src={colorSwatchDataUri(t.thumbnailColor)} className="w-3 h-3 rounded-full inline-block object-cover" />
                    )}
                    {t.title}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SurfaceCard>

        <SurfaceCard variant="raised" className="p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className={hpCn(hp.display, "text-lg text-gold/80 tabular-nums w-5 text-right shrink-0")}>02</span>
            <h2 className="font-semibold text-sm">Upload CSV</h2>
            <button onClick={downloadSampleCSV} className="ml-auto text-xs text-gold hover:underline flex items-center gap-1">
              <FileText size={12} /> Download sample CSV
            </button>
          </div>

          <div className={hpCn(hp.surface.inset, "border-2 border-dashed rounded-lg p-8 text-center")}>
            <Upload size={28} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-2">CSV with columns: <code className="bg-secondary px-1 py-0.5 rounded text-xs">name, greeting, date, subtitle</code></p>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-sm font-medium transition-colors">
                <Upload size={14} /> Choose CSV file
              </span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSVUpload} data-testid="input-csv-upload" />
            </label>
            {rows.length > 0 && (
              <p className="mt-3 text-xs text-foreground font-medium">{rows.length} rows loaded</p>
            )}
          </div>
        </SurfaceCard>

        {rows.length > 0 && (
          <SurfaceCard variant="raised" className="p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={hpCn(hp.display, "text-lg text-gold/80 tabular-nums w-5 text-right shrink-0")}>03</span>
              <h2 className="font-semibold text-sm">Preview & generate</h2>
              <span className="ml-auto text-xs text-muted-foreground">{doneCount}/{rows.length} done</span>
            </div>

            <div className="overflow-x-auto mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Greeting</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Date</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-secondary/30"}`} data-testid={`row-bulk-${i}`}>
                      <td className="py-2 px-3 font-medium">{row.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{row.greeting}</td>
                      <td className="py-2 px-3 text-muted-foreground">{row.date}</td>
                      <td className="py-2 px-3">
                        {row.status === "pending" && <span className="text-muted-foreground">Pending</span>}
                        {row.status === "generating" && <span className="text-pending flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Generating</span>}
                        {row.status === "done" && <span className="text-foreground flex items-center gap-1"><CheckCircle size={10} /> Done</span>}
                        {row.status === "error" && <span className="text-destructive flex items-center gap-1"><XCircle size={10} /> Error</span>}
                      </td>
                      <td className="py-2 px-3">
                        {row.status === "done" && row.dataUrl && (
                          <button onClick={() => downloadCard(row)} className="flex items-center gap-1 text-gold hover:underline" data-testid={`button-download-row-${i}`}>
                            <Download size={10} /> Download
                          </button>
                        )}
                        {row.dataUrl && (
                          <img src={row.dataUrl} alt={row.name} className="w-8 h-10 object-cover rounded mt-1 border border-border" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={generateAll}
                disabled={generating || !templateId}
                className={hp.btnPrimary}
                data-testid="button-generate-all"
              >
                {generating ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : <><Play size={14} /> Generate All ({rows.length})</>}
              </Button>
              {doneCount > 0 && (
                <Button variant="outline" onClick={downloadAll} className={hp.btnSecondary} data-testid="button-download-all">
                  <Download size={14} /> Download All ({doneCount})
                </Button>
              )}
            </div>
          </SurfaceCard>
        )}

        {rows.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Layers size={36} className="mx-auto mb-3 opacity-30" />
            <p>Upload a CSV to get started. Each row becomes one card.</p>
          </div>
        )}

        <canvas ref={hiddenCanvasRef} className="hidden" />
      </MarketingSection>
    </MarketingPageShell>
  );
}
