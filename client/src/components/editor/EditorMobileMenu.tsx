import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EditorRightPanel, type EditorRightPanelProps } from "./EditorRightPanel";
import { SharePanel } from "@/components/SharePanel";
import { BG_PRESETS, EMOJI_PRESETS, MobileEditorPanel, swatchDataUri } from "@/lib/editorConstants";
import {
  Download, Grid3x3, Image as ImageIcon, Maximize, Palette, Type, Undo2, Redo2,
  Upload, X, ZoomIn, ZoomOut,
} from "lucide-react";

interface EditorMobileMenuProps {
  panel: MobileEditorPanel | null;
  onPanelChange: (panel: MobileEditorPanel | null) => void;
  layers: any[];
  selectedObj: any;
  getLayerLabel: (obj: any) => string;
  onSelectLayer: (obj: any) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addText: () => void;
  addShape: (shape: "rect" | "circle" | "triangle" | "star") => void;
  addEmoji: (emoji: string) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, isLogo?: boolean) => void;
  isUploading: boolean;
  zoomLevel: number;
  zoomTo: (level: number) => void;
  fitCanvas: () => void;
  showGrid: boolean;
  setShowGrid: (v: boolean) => void;
  setBg: (val: string, type?: "color" | "gradient") => void;
  exportCard: (format: "png" | "jpeg" | "svg") => void;
  isText: boolean;
  onOpenEdit: () => void;
  editPanelProps: EditorRightPanelProps;
}

const PANEL_TITLES: Record<MobileEditorPanel, string> = {
  tools: "Add & tools",
  layers: "Layers",
  edit: "Edit selection",
  export: "Export & share",
};

function MobileAction({
  label,
  description,
  icon: Icon,
  onClick,
  file,
  accept,
  onFileChange,
  disabled,
  testId,
}: {
  label: string;
  description?: string;
  icon: typeof Type;
  onClick?: () => void;
  file?: boolean;
  accept?: string;
  onFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const inner = (
    <>
      <Icon size={16} className="text-gold shrink-0" />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="block text-xs text-muted-foreground mt-0.5">{description}</span> : null}
      </span>
    </>
  );

  if (file) {
    return (
      <label className={`mobile-editor-action ${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={testId}>
        {inner}
        <input type="file" accept={accept} className="hidden" disabled={disabled} onChange={onFileChange} />
      </label>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className="mobile-editor-action" data-testid={testId}>
      {inner}
    </button>
  );
}

export function EditorMobileMenu({
  panel,
  onPanelChange,
  layers,
  selectedObj,
  getLayerLabel,
  onSelectLayer,
  undo,
  redo,
  canUndo,
  canRedo,
  addText,
  addShape,
  addEmoji,
  handleImageUpload,
  isUploading,
  zoomLevel,
  zoomTo,
  fitCanvas,
  showGrid,
  setShowGrid,
  setBg,
  exportCard,
  isText,
  onOpenEdit,
  editPanelProps,
}: EditorMobileMenuProps) {
  const close = () => onPanelChange(null);

  return (
    <>
      <div className="lg:hidden border-t border-border bg-card px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex-shrink-0 editor-panel">
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {([
            { id: "tools" as const, label: "Add" },
            { id: "layers" as const, label: "Layers" },
            { id: "edit" as const, label: "Edit" },
            { id: "export" as const, label: "Export" },
          ]).map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === "edit") onOpenEdit();
                onPanelChange(item.id);
              }}
              className="flex flex-col items-center justify-center rounded-lg border border-border bg-secondary/50 hover:bg-secondary px-2 py-2.5 min-h-[52px] text-xs font-medium"
              data-testid={`mobile-tab-${item.id}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={undo} disabled={!canUndo}>
              <Undo2 size={14} /> Undo
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={redo} disabled={!canRedo}>
              <Redo2 size={14} /> Redo
            </Button>
          </div>
          <span className="text-[11px] text-muted-foreground">{zoomLevel}% zoom</span>
        </div>
      </div>

      {panel ? (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={close}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl flex flex-col max-h-[85vh] editor-panel"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 shrink-0 border-b border-border">
              <h3 className="font-semibold text-sm">{PANEL_TITLES[panel]}</h3>
              <button type="button" onClick={close} title="Close" className="p-1.5 rounded-full hover:bg-secondary">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              {panel === "tools" && (
                <div className="p-4 space-y-5">
                  <section>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add elements</p>
                    <div className="space-y-2">
                      <MobileAction label="Add text" description="Insert editable text" icon={Type} onClick={() => { addText(); close(); }} testId="mobile-add-text" />
                      <MobileAction label="Add photo" description="Upload portrait or image" icon={ImageIcon} file accept="image/*" disabled={isUploading} onFileChange={e => { handleImageUpload(e); close(); }} testId="mobile-add-photo" />
                      <MobileAction label="Add logo" description="Upload brand mark" icon={Upload} file accept="image/*" disabled={isUploading} onFileChange={e => { handleImageUpload(e, true); close(); }} testId="mobile-add-logo" />
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Shapes</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["Rectangle", "rect"],
                        ["Circle", "circle"],
                        ["Triangle", "triangle"],
                        ["Star sticker", "star"],
                      ] as const).map(([label, shape]) => (
                        <button key={shape} type="button" onClick={() => { addShape(shape); close(); }}
                          className="mobile-editor-action justify-center">
                          <Palette size={16} className="text-gold" />
                          <span className="text-sm font-medium">{label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Emojis</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {EMOJI_PRESETS.map(em => (
                        <button key={em} type="button" onClick={() => { addEmoji(em); close(); }}
                          className="flex items-center justify-center p-2 bg-secondary hover:bg-secondary/70 rounded text-xl">
                          {em}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Canvas view</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => zoomTo(Math.max(30, zoomLevel - 25))}><ZoomOut size={14} /></Button>
                      <span className="text-sm flex-1 text-center">{zoomLevel}%</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => zoomTo(Math.min(300, zoomLevel + 25))}><ZoomIn size={14} /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={fitCanvas}><Maximize size={14} /></Button>
                    </div>
                    <button type="button" onClick={() => setShowGrid(!showGrid)}
                      className={`mobile-editor-action w-full ${showGrid ? "border-primary/40 bg-primary/10" : ""}`}>
                      <Grid3x3 size={16} className="text-gold" />
                      <span className="text-sm font-medium">{showGrid ? "Snap grid on" : "Snap grid off"}</span>
                    </button>
                  </section>

                  <section>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick background</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {BG_PRESETS.slice(0, 6).map(bg => (
                        <button key={bg.value} type="button" onClick={() => { setBg(bg.value); close(); }} title={bg.label}
                          className="aspect-square rounded border border-border overflow-hidden">
                          <img alt="" aria-hidden="true" src={swatchDataUri(bg.value)} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {panel === "layers" && (
                <div className="p-3 space-y-1">
                  {layers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No layers yet</p>
                  ) : layers.map((obj, i) => (
                    <button key={i} type="button"
                      onClick={() => { onSelectLayer(obj); close(); }}
                      className={`w-full text-left px-3 py-3 rounded-lg text-sm flex items-center gap-2 border ${selectedObj === obj ? "border-primary/40 bg-primary/10" : "border-transparent hover:bg-secondary"}`}
                      data-testid={`mobile-layer-${i}`}>
                      {obj.type === "i-text" || obj.type === "text" || obj.type === "textbox" ? <Type size={14} /> : <ImageIcon size={14} />}
                      <span className="truncate">{getLayerLabel(obj)}</span>
                    </button>
                  ))}
                </div>
              )}

              {panel === "edit" && (
                <EditorRightPanel {...editPanelProps} className="flex-1 min-h-[50vh]" />
              )}

              {panel === "export" && (
                <div className="p-4">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {([
                      ["PNG", "png"],
                      ["JPG", "jpeg"],
                      ["SVG", "svg"],
                    ] as const).map(([label, fmt]) => (
                      <Button key={fmt} type="button" variant="outline" className="h-10" onClick={() => exportCard(fmt)}>
                        <Download size={14} /> {label}
                      </Button>
                    ))}
                  </div>
                  <SharePanel
                    fabricRef={editPanelProps.fabricRef}
                    projectTitle={editPanelProps.projectTitle}
                    projectId={editPanelProps.projectId}
                    onQROpen={() => {
                      editPanelProps.onQROpen();
                      close();
                    }}
                    svgTextMode={editPanelProps.svgTextMode}
                    onSvgTextModeChange={editPanelProps.onSvgTextModeChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
