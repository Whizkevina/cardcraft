import type { RefObject } from "react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { SharePanel } from "@/components/SharePanel";
import type { SvgTextMode } from "@/lib/svgTextExport";
import {
  BG_PRESETS, EDITOR_FONTS, EditorPanelTab, fontPreviewClass, swatchDataUri,
} from "@/lib/editorConstants";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, ChevronDown, ChevronUp, Italic,
  Lock, Loader2 as SpinIcon, RotateCcw, Trash2, Type, Unlock, Wand2, RefreshCw,
} from "lucide-react";

export interface EditorRightPanelProps {
  tab: EditorPanelTab;
  onTabChange: (tab: EditorPanelTab) => void;
  className?: string;
  panelSelection: any;
  isText: boolean;
  isImage: boolean;
  isLocked: boolean;
  opacity: number;
  fillColor: string;
  imageRx: number;
  textValue: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textAlign: string;
  isBold: boolean;
  isItalic: boolean;
  removingBg: boolean;
  fabricRef: RefObject<any>;
  replacePhotoInputRef: RefObject<HTMLInputElement>;
  projectTitle: string;
  projectId: number | null;
  svgTextMode: SvgTextMode;
  onSvgTextModeChange: (mode: SvgTextMode) => void;
  onQROpen: () => void;
  updateSelectedProp: (prop: string, value: any) => void;
  bringForward: () => void;
  sendBackward: () => void;
  toggleLock: () => void;
  deleteSelected: () => void;
  setBg: (val: string, type?: "color" | "gradient") => void;
  setImageBorderRadius: (radius: number) => void;
  removeBackground: () => void;
  handleReplacePhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getSelectedCanvasObject: () => any;
  syncSelectedObject: (obj: any | null) => void;
  onClearCanvas: () => void;
}

export function EditorRightPanel({
  tab,
  onTabChange,
  className = "",
  panelSelection,
  isText,
  isImage,
  isLocked,
  opacity,
  fillColor,
  imageRx,
  textValue,
  textColor,
  fontSize,
  fontFamily,
  textAlign,
  isBold,
  isItalic,
  removingBg,
  fabricRef,
  replacePhotoInputRef,
  projectTitle,
  projectId,
  svgTextMode,
  onSvgTextModeChange,
  onQROpen,
  updateSelectedProp,
  bringForward,
  sendBackward,
  toggleLock,
  deleteSelected,
  setBg,
  setImageBorderRadius,
  removeBackground,
  handleReplacePhoto,
  getSelectedCanvasObject,
  syncSelectedObject,
  onClearCanvas,
}: EditorRightPanelProps) {
  return (
    <Tabs value={tab} onValueChange={v => onTabChange(v as EditorPanelTab)} className={`flex flex-col ${className}`}>
      <TabsList className="w-full rounded-none border-b border-border h-10 bg-card shrink-0">
        <TabsTrigger value="style" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary">Style</TabsTrigger>
        <TabsTrigger value="text" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary" data-testid="tab-text">Text</TabsTrigger>
        <TabsTrigger value="export" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary">Export</TabsTrigger>
      </TabsList>

      <TabsContent value="style" className="flex-1 p-3 space-y-4 mt-0 overflow-y-auto">
        {panelSelection && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Object</p>
            <div className="grid grid-cols-4 gap-1">
              <button onClick={bringForward} title="Bring Forward" className="p-1.5 rounded bg-secondary hover:bg-secondary/70 flex items-center justify-center" data-testid="button-bring-forward"><ChevronUp size={14} /></button>
              <button onClick={sendBackward} title="Send Backward" className="p-1.5 rounded bg-secondary hover:bg-secondary/70 flex items-center justify-center" data-testid="button-send-backward"><ChevronDown size={14} /></button>
              <button onClick={toggleLock} title={isLocked ? "Unlock" : "Lock"} className="p-1.5 rounded bg-secondary hover:bg-secondary/70 flex items-center justify-center" data-testid="button-toggle-lock">
                {isLocked ? <Unlock size={14} /> : <Lock size={14} />}
              </button>
              <button onClick={deleteSelected} title="Delete" className="p-1.5 rounded bg-destructive/20 hover:bg-destructive/40 text-destructive flex items-center justify-center" data-testid="button-delete-object"><Trash2 size={14} /></button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Opacity: {opacity}%</Label>
              <Slider min={10} max={100} step={1} value={[opacity]} onValueChange={([v]) => updateSelectedProp("opacity", v / 100)} data-testid="slider-opacity" />
            </div>

            {!isImage && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Fill Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={fillColor.startsWith("#") ? fillColor : "#FFFFFF"} aria-label="Fill color" title="Fill color"
                    onChange={e => updateSelectedProp("fill", e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-fill-color" />
                  <span className="text-xs text-muted-foreground">{fillColor}</span>
                </div>
              </div>
            )}

            {isImage && (
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Replace Photo</Label>
                  <label className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/70 cursor-pointer transition-colors text-xs" data-testid="label-replace-photo">
                    <RefreshCw size={13} className="text-primary" />
                    Swap Photo
                    <input type="file" accept="image/*" className="hidden" ref={replacePhotoInputRef} onChange={handleReplacePhoto} />
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Corner Radius</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: "None", icon: "▭", value: 0 },
                      { label: "Soft", icon: "▢", value: 15 },
                      { label: "Round", icon: "⬜", value: 35 },
                      { label: "Circle", icon: "●", value: 50 },
                    ].map(r => {
                      const active =
                        (r.value === 0 && imageRx === 0) ||
                        (r.value === 15 && imageRx > 0 && imageRx < 25) ||
                        (r.value === 35 && imageRx >= 25 && imageRx < 50) ||
                        (r.value === 50 && imageRx >= 50);
                      return (
                        <button key={r.value} onClick={() => setImageBorderRadius(r.value)} title={r.label}
                          className={`py-2 rounded text-xs font-medium transition-colors border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                          data-testid={`button-radius-${r.label.toLowerCase()}`}>
                          {r.icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Background Removal</Label>
                  <button onClick={removeBackground} disabled={removingBg}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/70 disabled:opacity-50 transition-colors text-xs"
                    data-testid="button-remove-bg">
                    {removingBg
                      ? <><SpinIcon size={13} className="animate-spin text-primary" /> Removing background...</>
                      : <><Wand2 size={13} className="text-gold" /> Remove Background</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Background</p>
          <div className="grid grid-cols-4 gap-1.5">
            {BG_PRESETS.map(bg => (
              <button key={bg.value} onClick={() => setBg(bg.value)} title={bg.label}
                className="w-full aspect-square rounded-md border border-border hover:scale-110 transition-transform"
                data-testid={`button-bg-${bg.label.replace(/\s+/g, "-").toLowerCase()}`}>
                <img alt="" aria-hidden="true" src={swatchDataUri(bg.value)} className="w-full h-full rounded-md object-cover" />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" defaultValue="#1a0533" onChange={e => setBg(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-bg-color" />
            <span className="text-xs text-muted-foreground">Custom color</span>
          </div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider !mt-4">Gradient Backgrounds</p>
          <div className="grid grid-cols-4 gap-1.5">
            {BG_PRESETS.map(bg => (
              <button key={`grad-${bg.value}`} onClick={() => setBg(bg.value, "gradient")} title={`${bg.label} Gradient`}
                className="w-full aspect-square rounded-md border border-border hover:scale-110 transition-transform"
                style={{ background: `linear-gradient(to bottom, ${bg.value}, #111)` }}
              />
            ))}
          </div>
        </div>

        <button onClick={onClearCanvas}
          className="w-full text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2 text-muted-foreground" data-testid="button-reset-canvas">
          <RotateCcw size={12} /> Clear Canvas
        </button>
      </TabsContent>

      <TabsContent value="text" className="flex-1 p-3 space-y-4 mt-0 overflow-y-auto">
        {isText ? (
          <>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Text Content</Label>
              <textarea className="w-full bg-input text-xs p-2 rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3} placeholder="Edit text" value={textValue} onChange={e => updateSelectedProp("text", e.target.value)} data-testid="textarea-text-content" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Font Family</Label>
              <Select value={fontFamily} onValueChange={v => updateSelectedProp("fontFamily", v)}>
                <SelectTrigger className="h-8 text-xs" data-testid="select-font-family">
                  <SelectValue>
                    <span className={fontPreviewClass(fontFamily)}>{fontFamily}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EDITOR_FONTS.map(f => (
                    <SelectItem key={f} value={f}>
                      <span className={fontPreviewClass(f)}>{f}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Font Size: {fontSize}px</Label>
              <Slider min={8} max={100} step={1} value={[fontSize]} onValueChange={([v]) => updateSelectedProp("fontSize", v)} data-testid="slider-font-size" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Text Color</Label>
              <input type="color" value={textColor.startsWith("#") ? textColor : "#FFFFFF"} aria-label="Text color" title="Text color"
                onChange={e => updateSelectedProp("fill", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-text-color" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Opacity: {opacity}%</Label>
              <Slider min={10} max={100} step={1} value={[opacity]} onValueChange={([v]) => updateSelectedProp("opacity", v / 100)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Style & Alignment</Label>
              <div className="flex items-center gap-1 flex-wrap">
                <button onClick={() => updateSelectedProp("fontWeight", isBold ? "normal" : "bold")} title="Bold"
                  className={`p-1.5 rounded border text-xs ${isBold ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`} data-testid="button-bold"><Bold size={12} /></button>
                <button onClick={() => updateSelectedProp("fontStyle", isItalic ? "normal" : "italic")} title="Italic"
                  className={`p-1.5 rounded border text-xs ${isItalic ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`} data-testid="button-italic"><Italic size={12} /></button>
                <button onClick={() => updateSelectedProp("textAlign", "left")} title="Align left" className={`p-1.5 rounded border ${textAlign === "left" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignLeft size={12} /></button>
                <button onClick={() => updateSelectedProp("textAlign", "center")} title="Align center" className={`p-1.5 rounded border ${textAlign === "center" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignCenter size={12} /></button>
                <button onClick={() => updateSelectedProp("textAlign", "right")} title="Align right" className={`p-1.5 rounded border ${textAlign === "right" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignRight size={12} /></button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Text Shadow</Label>
              <button
                onClick={() => {
                  const canvas = fabricRef.current;
                  const obj = getSelectedCanvasObject();
                  if (!canvas || !obj) return;
                  const f = (window as any).fabric;
                  if (obj.shadow) obj.set("shadow", null);
                  else obj.set("shadow", new f.Shadow({ color: "rgba(0,0,0,0.5)", blur: 6, offsetX: 2, offsetY: 2 }));
                  canvas.renderAll();
                  syncSelectedObject(canvas.getActiveObject() ?? obj);
                }}
                className={`w-full text-xs px-2 py-2 rounded border ${panelSelection?.shadow ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}
                data-testid="button-shadow"
              >
                {panelSelection?.shadow ? "Shadow On" : "Shadow Off"}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Type size={24} className="mx-auto text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">Select a text element to edit</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="export" className="flex-1 p-3 mt-0 overflow-y-auto">
        <SharePanel
          fabricRef={fabricRef}
          projectTitle={projectTitle}
          projectId={projectId}
          onQROpen={onQROpen}
          svgTextMode={svgTextMode}
          onSvgTextModeChange={onSvgTextModeChange}
        />
      </TabsContent>
    </Tabs>
  );
}
