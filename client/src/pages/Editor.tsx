import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { trackFeatureEvent } from "@/hooks/useTelemetry";
import { applySvgTextMode, type SvgTextMode } from "@/lib/svgTextExport";
import {
  ArrowLeft, Download, Save, Upload, Type, Palette, Layers,
  Lock, Unlock,
  Image as ImageIcon, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Loader2 as SpinIcon,
  Grid3x3, Crown
} from "lucide-react";
import type { Template, Project } from "@shared/schema";
import { QRDialog } from "../components/QRDialog";
import { EditorRightPanel, type EditorRightPanelProps } from "@/components/editor/EditorRightPanel";
import { EditorMobileMenu } from "@/components/editor/EditorMobileMenu";
import { EMOJI_PRESETS, type EditorPanelTab, type MobileEditorPanel } from "@/lib/editorConstants";
import { useFabric } from "@/hooks/useFabric";
import { loadDesignJson } from "@/lib/loadDesignJson";
import { isTextObject, normalizeCanvasTextObjects, prepareCanvasForExport, sanitizeFabricJsonData } from "@/lib/fabricTextFix";

const EXPORT_PRESETS = [
  { label: "Original (800×1000)", w: 800, h: 1000, multiplier: 2 },
  { label: "Square Social (1080×1080)", w: 1080, h: 1080, multiplier: 2.7 },
  { label: "Portrait Story (1080×1920)", w: 1080, h: 1920, multiplier: 2.7 },
  { label: "Portrait Flyer (1200×1500)", w: 1200, h: 1500, multiplier: 3 },
];

const MAX_CANVAS_W = 460;
const MAX_CANVAS_H = 560;
// These are dynamic — set after loading template
let CANVAS_W = 400;
let CANVAS_H = 500;
let SRC_W = 800;
let SRC_H = 1000;

export default function Editor() {
  const [, setLocation] = useLocation();
  const { user, isPro } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef(false);
  /** Last selected canvas object — kept when sidebar controls steal focus from Fabric */
  const selectedObjectRef = useRef<any>(null);
  const panelInteractionRef = useRef(false);

  const { fabricLoaded } = useFabric();
  const [canvasReady, setCanvasReady] = useState(false);
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Card");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobileEditorPanel | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exportPreset, setExportPreset] = useState(EXPORT_PRESETS[0]);
  const [svgTextMode, setSvgTextMode] = useState<SvgTextMode>("embed");
  const [isDirty, setIsDirty] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<EditorPanelTab>("style");
  // ref to track replace-photo input for currently selected image
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);

  const params = useParams<{ templateId?: string; projectId?: string }>();
  const templateId = params.templateId || null;
  const editProjectId = params.projectId || null;

  const { data: template, error: templateError, isError: templateLoadError, isLoading: templateLoading } = useQuery<Template>({
    queryKey: ["/api/templates", templateId],
    queryFn: async () => {
      const res = await fetch(`/api/templates/${templateId}`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        const err = new Error(body.error || "This template requires Pro.") as Error & { code?: string };
        err.code = body.code;
        throw err;
      }
      if (!res.ok) throw new Error(body.error || "Failed to load template");
      return body;
    },
    enabled: !!templateId,
    retry: false,
  });

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", editProjectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${editProjectId}`);
      return res.json();
    },
    enabled: !!editProjectId,
  });

  // Fabric.js is loaded on demand via useFabric() / loadFabric()

  // ─── History helpers ──────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    if (!fabricRef.current || isHistoryActionRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON(["customType","editable","movable","resizable","styleEditable","locked"]));
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    // Truncate forward history
    historyRef.current = [...history.slice(0, idx + 1), json];
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const loadHistoryState = useCallback((json: string) => {
    if (!fabricRef.current) return;
    const data = JSON.parse(json);
    sanitizeFabricJsonData(data);
    fabricRef.current.loadFromJSON(data, () => {
      normalizeCanvasTextObjects(fabricRef.current);
      fabricRef.current.renderAll();
      isHistoryActionRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0 || !fabricRef.current) return;
    isHistoryActionRef.current = true;
    historyIndexRef.current--;
    loadHistoryState(historyRef.current[historyIndexRef.current]);
  }, [loadHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricRef.current) return;
    isHistoryActionRef.current = true;
    historyIndexRef.current++;
    loadHistoryState(historyRef.current[historyIndexRef.current]);
  }, [loadHistoryState]);

  const syncSelectedObject = useCallback((obj: any | null) => {
    selectedObjectRef.current = obj;
    setSelectedObj(obj);
  }, []);

  const getSelectedCanvasObject = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return canvas.getActiveObject() ?? selectedObjectRef.current;
  }, []);

  // ─── Init canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fabricLoaded || !canvasRef.current || fabricRef.current) return;
    if (templateId && templateLoading) return;
    if (templateId && templateLoadError) return;
    if (editProjectId && !project) return;
    const f = (window as any).fabric;
    const canvas = new f.Canvas(canvasRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: '#111',
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e: any) => syncSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:updated", (e: any) => syncSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => {
      if (panelInteractionRef.current) {
        panelInteractionRef.current = false;
        return;
      }
      syncSelectedObject(null);
    });
    canvas.on("object:modified", () => {
      syncSelectedObject(canvas.getActiveObject() ?? selectedObjectRef.current);
      saveHistory();
      setIsDirty(true);
    });
    canvas.on("object:added", () => { saveHistory(); setIsDirty(true); });
    canvas.on("object:removed", () => { saveHistory(); setIsDirty(true); });

    canvas.on("before:render", () => normalizeCanvasTextObjects(canvas));

    // Grid snapping logic
    const grid = 20;
    canvas.on("object:moving", (options: any) => {
      // NOTE: Checking the React state explicitly via a ref wouldn't re-bind this event listener perfectly unless we update the event listener or attach a property to the canvas.
      // So we attach a flag `snapToGrid` to the canvas itself when showGrid state toggles.
      if (!canvas.snapToGrid) return;
      options.target.set({
        left: Math.round(options.target.left / grid) * grid,
        top: Math.round(options.target.top / grid) * grid
      });
    });

    // Single-click selects, double-click enters text edit mode
    canvas.on("mouse:dblclick", (opt: any) => {
      const target = opt.target;
      if (target && (target.type === "i-text" || target.type === "text" || target.type === "textbox")) {
        canvas.setActiveObject(target);
        target.enterEditing();
        target.selectAll();
        canvas.renderAll();
      }
    });

    // Zoom with scroll
    canvas.on("mouse:wheel", (opt: any) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.min(Math.max(zoom, 0.3), 3);
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      setZoomLevel(Math.round(zoom * 100));
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    setCanvasReady(true);
    return () => {
      canvas.dispose();
      fabricRef.current = null;
      setCanvasReady(false);
    };
  }, [fabricLoaded, templateId, editProjectId, templateLoading, templateLoadError, project, saveHistory, syncSelectedObject]);

  // Clicks on the sidebar / Radix dropdowns deselect Fabric objects — ignore that clear.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      const inEditorChrome = target.closest(
        ".editor-panel, [role='tablist'], [role='tab'], [role='listbox'], [data-radix-popper-content-wrapper], [data-radix-select-viewport]",
      );
      panelInteractionRef.current = !!inEditorChrome;
    };
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, []);

  // ─── Load template / project ──────────────────────────────────────────────
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;

    const loadJson = async (jsonStr: string) => {
      try {
        const layout = await loadDesignJson(canvas, jsonStr, {
          interactive: true,
          maxWidth: MAX_CANVAS_W,
          maxHeight: MAX_CANVAS_H,
          beforeAdd: (obj, fabricObj) => {
            if (obj.locked) {
              fabricObj.selectable = false;
              fabricObj.evented = false;
            }
          },
        });

        SRC_W = layout.srcWidth;
        SRC_H = layout.srcHeight;
        CANVAS_W = layout.displayWidth;
        CANVAS_H = layout.displayHeight;

        window.setTimeout(() => {
          historyRef.current = [];
          historyIndexRef.current = -1;
          saveHistory();
        }, 200);
      } catch (e) {
        console.error("Failed to load canvas JSON", e);
      }
    };

    if (project) {
      setProjectTitle(project.title);
      setProjectId(project.id);
      void loadJson(project.designJson);
    } else if (template) {
      setProjectTitle(`${template.title} — ${new Date().toLocaleDateString()}`);
      void loadJson(template.canvasJson);
    } else {
      canvas.setBackgroundColor("#1a0533", canvas.renderAll.bind(canvas));
      saveHistory();
    }
  }, [canvasReady, template, project, saveHistory]);

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        const active = fabricRef.current?.getActiveObject();
        // Only delete object if:
        // 1. There is an active object
        // 2. It is NOT a text object currently in edit mode (user typing)
        // 3. The focused element is NOT an input/textarea (panel fields)
        const focusedTag = (document.activeElement as HTMLElement)?.tagName?.toLowerCase();
        const isInputFocused = focusedTag === "input" || focusedTag === "textarea";
        const isTextEditing = (active?.type === "i-text" || active?.type === "text" || active?.type === "textbox") && (active as any).isEditing;
        if (active && !isTextEditing && !isInputFocused) {
          fabricRef.current?.remove(active);
          fabricRef.current?.renderAll();
          setSelectedObj(null);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // ─── Unsaved changes warning ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ─── Gridlines rendering ───────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    
    // Toggle internal snap flag
    canvas.snapToGrid = showGrid;
    
    // Clear old grids
    const oldGrids = canvas.getObjects().filter((o: any) => o.customType === "gridgroup");
    oldGrids.forEach((gObj: any) => canvas.remove(gObj));

    if (showGrid) {
      const f = (window as any).fabric;
      const gridSize = 20;
      const lines = [];
      const gridOptions = {
        stroke: 'rgba(255,255,255,0.1)', 
        strokeWidth: 1, 
        selectable: false, 
        evented: false,
        excludeFromExport: true
      };
      
      for (let i = 0; i <= Math.ceil(canvas.width / gridSize); i++) {
        lines.push(new f.Line([ i * gridSize, 0, i * gridSize, canvas.height], gridOptions));
      }
      for (let i = 0; i <= Math.ceil(canvas.height / gridSize); i++) {
        lines.push(new f.Line([ 0, i * gridSize, canvas.width, i * gridSize], gridOptions));
      }
      
      const gridGroup = new f.Group(lines, {
        left: 0, top: 0, selectable: false, evented: false, customType: 'gridgroup', excludeFromExport: true
      });
      canvas.add(gridGroup);
      
      // Push grid to back, but just above background
      canvas.sendToBack(gridGroup);
      const bgObj = canvas.getObjects().find((o: any) => o.customType === "background" || (o.type === "rect" && !o.selectable && o.width >= canvas.width - 20));
      if (bgObj) {
        canvas.bringForward(gridGroup);
      }
    }
    
    canvas.renderAll();
  }, [showGrid, canvasReady]);

  // ─── Replace photo in-place ────────────────────────────────────────
  const handleReplacePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const obj = fabricRef.current?.getActiveObject();
    if (!file || !obj || obj.type !== "image" || !fabricRef.current) return;
    const f = (window as any).fabric;
    const canvas = fabricRef.current;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Preserve position, scale, angle, clipPath and customType
        const newImg = new f.Image(img, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle || 0,
          customType: obj.customType,
          clipPath: obj.clipPath,
        });
        canvas.remove(obj);
        canvas.add(newImg);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        setSelectedObj(newImg);
        setIsDirty(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ─── Object manipulation ──────────────────────────────────────────────────
  const updateSelectedProp = (prop: string, value: any) => {
    const canvas = fabricRef.current;
    const obj = getSelectedCanvasObject();
    if (!canvas || !obj) return;

    if (!canvas.getActiveObject()) {
      canvas.setActiveObject(obj);
    }

    const isTextObj = isTextObject(obj);
    if (isTextObj) {
      obj.textBaseline = "alphabetic";
    }

    obj.set(prop, value);
    if (isTextObj && (prop === "fontSize" || prop === "fontFamily" || prop === "text" || prop === "fontWeight" || prop === "fontStyle" || prop === "textAlign" || prop === "fill")) {
      obj.initDimensions?.();
      obj.setCoords?.();
      obj.dirty = true;
    }
    canvas.renderAll();
    syncSelectedObject(canvas.getActiveObject() ?? obj);
    setIsDirty(true);
  };

  const bringForward = () => { fabricRef.current?.getActiveObject()?.bringForward(); fabricRef.current?.renderAll(); };
  const sendBackward = () => { fabricRef.current?.getActiveObject()?.sendBackwards(); fabricRef.current?.renderAll(); };

  const toggleLock = () => {
    const obj = getSelectedCanvasObject();
    if (!obj) return;
    const locked = !obj.selectable;
    obj.selectable = locked; obj.evented = locked;
    fabricRef.current?.renderAll();
    syncSelectedObject(obj);
  };

  const deleteSelected = () => {
    const obj = fabricRef.current?.getActiveObject() ?? selectedObjectRef.current;
    if (!obj) return;
    fabricRef.current?.remove(obj);
    fabricRef.current?.renderAll();
    syncSelectedObject(null);
  };

  const addText = () => {
    const f = (window as any).fabric;
    if (!f || !fabricRef.current) return;
    const text = new f.IText("New Text", {
      left: 80, top: 200, fontSize: 24, fontFamily: "Georgia", fill: "#FFFFFF",
      textAlign: "center", textBaseline: "alphabetic",
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  const addShape = (shape: "rect" | "circle" | "triangle" | "star") => {
    const f = (window as any).fabric;
    if (!f || !fabricRef.current) return;
    
    let obj: any;
    if (shape === "rect") {
      obj = new f.Rect({ left: 80, top: 180, width: 150, height: 80, fill: "#FFD700", rx: 8, ry: 8 });
    } else if (shape === "circle") {
      obj = new f.Circle({ left: 80, top: 180, radius: 60, fill: "#FFD700" });
    } else if (shape === "triangle") {
      obj = new f.Triangle({ left: 80, top: 180, width: 100, height: 100, fill: "#FFD700" });
    } else if (shape === "star") {
      obj = new f.Polygon([
        { x: 50, y: 0 }, { x: 61, y: 35 }, { x: 98, y: 35 }, { x: 68, y: 57 },
        { x: 79, y: 91 }, { x: 50, y: 70 }, { x: 21, y: 91 }, { x: 32, y: 57 },
        { x: 2, y: 35 }, { x: 39, y: 35 }
      ], { left: 80, top: 180, fill: "#FFD700" });
    }
    
    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    saveHistory();
  };

  const addEmoji = (emoji: string) => {
    const f = (window as any).fabric;
    if (!f || !fabricRef.current) return;
    
    const text = new f.Text(emoji, { 
      left: 100, 
      top: 180, 
      fontSize: 80,
      fontFamily: "Arial, sans-serif",
      textAlign: "center"
    });
    
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
    saveHistory();
  };

  const setBg = (val: string, type: "color" | "gradient" = "color") => {
    if (!fabricRef.current) return;
    
    const canvas = fabricRef.current;
    // Look for dedicated background object, OR a full-canvas sized rectangle sitting at the back
    const bgObj = canvas.getObjects().find((o: any) => o.customType === "background" || (o.type === "rect" && o.width >= canvas.width - 20 && o.height >= canvas.height - 20 && o.left <= 10 && o.top <= 10 && !o.selectable));
    
    let fillVal: any = val;

    if (type === "gradient") {
      const f = (window as any).fabric;
      fillVal = new f.Gradient({
        type: 'linear',
        coords: { x1: 0, y1: 0, x2: 0, y2: bgObj ? bgObj.height : canvas.height },
        colorStops: [
          { offset: 0, color: val },
          { offset: 1, color: '#111' }
        ]
      });
    }

    if (bgObj) {
      bgObj.set("fill", fillVal);
      canvas.renderAll();
    } else {
      // Fallback: apply to root canvas background property
      canvas.setBackgroundColor(fillVal, canvas.renderAll.bind(canvas));
    }
    
    saveHistory();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isLogo = false) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    
    setIsUploading(true);
    const toastId = toast({ title: "Adding image...", description: "Please wait.", duration: 2000 });
    
    const f = (window as any).fabric;
    const canvas = fabricRef.current;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // ── Canva-style: if a photo_frame is selected or exists, snap into it ──
        const frameObj = (() => {
          const active = canvas.getActiveObject();
          // Selected object is a frame → use it
          if (active?.customType === "photo_frame" || active?.customType === "logo") return active;
          if (isLogo) {
            // Find first logo zone
            return canvas.getObjects().find((o: any) => o.customType === "logo") || null;
          }
          // Find first photo_frame
          return canvas.getObjects().find((o: any) => o.customType === "photo_frame") || null;
        })();

        if (frameObj) {
          const frameType = frameObj.customType || (isLogo ? "logo" : "photo_frame");
          
          // ── Frame dimensions in canvas coordinates ──
          const center = frameObj.getCenterPoint();
          const fw = frameObj.getScaledWidth();
          const fh = frameObj.getScaledHeight();
          const frameAngle = frameObj.angle || 0;

          // Cover-fit: scale image so it fills the frame (like CSS background-size: cover)
          const scaleX = fw / img.width;
          const scaleY = fh / img.height;
          const scale  = Math.max(scaleX, scaleY);

          const fabricImg = new f.Image(img, {
            originX: 'center',
            originY: 'center',
            left: center.x,
            top: center.y,
            scaleX: scale,
            scaleY: scale,
            angle: frameAngle,
            customType: frameType,
          });

          // ── Apply clip path matching the frame's shape ──
          const isCircle = frameObj.type === "circle" || (frameObj.rx && frameObj.rx >= (Math.min(frameObj.width || 100, frameObj.height || 100) / 2) * 0.9);
          
          if (isCircle) {
            // Circular frame → circular clip
            fabricImg.clipPath = new f.Circle({
              originX: 'center',
              originY: 'center',
              radius: Math.min(fw, fh) / 2 / scale,
              left: 0,
              top: 0,
              absolutePositioned: false,
            });
          } else if (frameObj.rx && frameObj.rx > 4) {
            // Rounded rect frame → rounded clip
            const clipRx = (frameObj.rx * (frameObj.scaleX || 1)) / scale;
            const clipRy = (frameObj.ry * (frameObj.scaleY || 1)) / scale;
            fabricImg.clipPath = new f.Rect({
              originX: 'center',
              originY: 'center',
              width:  fw / scale,
              height: fh / scale,
              rx: clipRx, ry: clipRy,
              left: 0,
              top: 0,
              absolutePositioned: false,
            });
          } else {
            // Plain rect frame → rect clip
            fabricImg.clipPath = new f.Rect({
              originX: 'center',
              originY: 'center',
              width:  fw / scale,
              height: fh / scale,
              left: 0,
              top: 0,
              absolutePositioned: false,
            });
          }

          // Replace the frame completely with the newly cropped image
          const frameIndex = canvas.getObjects().indexOf(frameObj);
          canvas.remove(frameObj);
          canvas.add(fabricImg);
          
          if (frameIndex >= 0 && typeof (fabricImg as any).moveTo === "function") {
            (fabricImg as any).moveTo(frameIndex);
          }
          canvas.setActiveObject(fabricImg);
        } else {
          // ── No frame found — free placement ──
          const maxPx = isLogo ? 80 : 160;
          const scale = Math.min(maxPx / img.width, maxPx / img.height);
          const fabricImg = new f.Image(img, {
            left: 30, top: 30, scaleX: scale, scaleY: scale,
            customType: isLogo ? "logo_image" : "photo_image",
          });
          canvas.add(fabricImg);
          canvas.setActiveObject(fabricImg);
        }
        canvas.renderAll();
        saveHistory();
        setIsDirty(true);
        setIsUploading(false);
      };
      
      img.onerror = () => {
        setIsUploading(false);
        toast({ title: "Error", description: "Failed to load image. Please try another.", variant: "destructive" });
      };
      
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => {
      setIsUploading(false);
      toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ─── Image: Remove Background ────────────────────────────────────────────
  const [removingBg, setRemovingBg] = useState(false);

  const removeBackground = async () => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== "image") return;
    const f = (window as any).fabric;

    setRemovingBg(true);
    try {
      // Get image data from the fabric image
      const tempCanvas = document.createElement("canvas");
      const imgEl = obj.getElement();
      tempCanvas.width = imgEl.naturalWidth || imgEl.width;
      tempCanvas.height = imgEl.naturalHeight || imgEl.height;
      const ctx = tempCanvas.getContext("2d")!;
      ctx.drawImage(imgEl, 0, 0, tempCanvas.width, tempCanvas.height);

      // Use remove.bg API via canvas pixel manipulation (simple color-based removal)
      // For now: use a smart edge-detection approach on the canvas
      const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;

      // Sample corner pixels as "background color" candidates
      const corners = [
        [data[0], data[1], data[2]],           // top-left
        [data[(tempCanvas.width - 1) * 4], data[(tempCanvas.width - 1) * 4 + 1], data[(tempCanvas.width - 1) * 4 + 2]], // top-right
        [data[((tempCanvas.height - 1) * tempCanvas.width) * 4], data[((tempCanvas.height - 1) * tempCanvas.width) * 4 + 1], data[((tempCanvas.height - 1) * tempCanvas.width) * 4 + 2]], // bottom-left
      ];

      // Pick the most common corner color as background
      const [bgR, bgG, bgB] = corners[0];
      const threshold = 55; // color distance tolerance

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
        if (dist < threshold) {
          data[i + 3] = 0; // Make transparent
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // Create new fabric image from processed canvas
      const newDataURL = tempCanvas.toDataURL("image/png");
      const newImg = new Image();
      newImg.crossOrigin = "anonymous";
      newImg.onload = () => {
        const newFabricImg = new f.Image(newImg, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle || 0,
          customType: obj.customType,
        });
        const canvas = fabricRef.current;
        canvas.remove(obj);
        canvas.add(newFabricImg);
        canvas.setActiveObject(newFabricImg);
        canvas.renderAll();
        setSelectedObj(newFabricImg);
        setRemovingBg(false);
        toast({ title: "Background removed!", description: "Works best on solid-color backgrounds." });
      };
      newImg.src = newDataURL;
    } catch (e: any) {
      setRemovingBg(false);
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  // ─── Image: Border radius (clipPath) ─────────────────────────────────────
  const setImageBorderRadius = (radius: number) => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || obj.type !== "image") return;
    obj.set("rx", radius);
    obj.set("ry", radius);
    // Apply clip path as rounded rect
    const f = (window as any).fabric;
    if (radius === 0) {
      obj.clipPath = undefined;
    } else if (radius >= 50) {
      // Full circle
      const minDim = Math.min((obj.width || 100) * (obj.scaleX || 1), (obj.height || 100) * (obj.scaleY || 1));
      obj.clipPath = new f.Circle({
        radius: minDim / 2 / (obj.scaleX || 1),
        left: -(obj.width || 100) / 2,
        top: -(obj.height || 100) / 2,
        originX: "left",
        originY: "top",
      });
    } else {
      const r = radius / 100 * Math.min((obj.width || 100), (obj.height || 100)) * 0.5;
      obj.clipPath = new f.Rect({
        width: obj.width || 100,
        height: obj.height || 100,
        rx: r,
        ry: r,
        left: -(obj.width || 100) / 2,
        top: -(obj.height || 100) / 2,
        originX: "left",
        originY: "top",
      });
    }
    fabricRef.current.renderAll();
    syncSelectedObject(obj);
    saveHistory();
  };

  // ─── Zoom controls ────────────────────────────────────────────────────────
  const zoomTo = (level: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const center = { x: CANVAS_W / 2, y: CANVAS_H / 2 };
    canvas.zoomToPoint(center, level / 100);
    setZoomLevel(level);
  };

  const fitCanvas = () => zoomTo(100);

  // ─── Save project ─────────────────────────────────────────────────────────
  const saveProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to save");
      const canvas = fabricRef.current;
      if (!canvas) return;
      const currentZoom = canvas.getZoom();
      canvas.setZoom(1);
      const objects = canvas.getObjects().map((o: any) =>
        o.toJSON(["customType","editable","movable","resizable","styleEditable","locked"])
      );
      const designJson = JSON.stringify({ objects, background: canvas.backgroundColor });
      const thumbnail = canvas.toDataURL({ format: "jpeg", quality: 0.5, multiplier: 0.3 });
      canvas.setZoom(currentZoom);

      if (projectId) {
        const res = await apiRequest("PATCH", `/api/projects/${projectId}`, {
          title: projectTitle, designJson, thumbnail, templateId: template?.id ?? null,
        });
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/projects", {
          title: projectTitle, designJson, thumbnail,
          templateId: template?.id ?? null, exportSettings: "{}",
        });
        return res.json();
      }
    },
    onSuccess: (data: any) => {
      if (data?.id && !projectId) setProjectId(data.id);
      qc.refetchQueries({ queryKey: ["/api/projects"] });
      setIsDirty(false);
      toast({ title: "Saved!", description: "Your card has been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ─── Guest save handoff ───────────────────────────────────────────────────
  const savePendingAndAuth = () => {
    const canvas = fabricRef.current;
    if (!canvas) {
      setLocation("/auth");
      return;
    }

    try {
      const currentZoom = canvas.getZoom();
      canvas.setZoom(1);
      const objects = canvas.getObjects().map((o: any) =>
        o.toJSON(["customType", "editable", "movable", "resizable", "styleEditable", "locked"])
      );
      const designJson = JSON.stringify({ objects, background: canvas.backgroundColor });
      canvas.setZoom(currentZoom);

      sessionStorage.setItem("pendingDesign", JSON.stringify({
        title: projectTitle,
        designJson,
        templateId: template?.id ?? null,
      }));

      toast({ title: "Design saved", description: "Sign in to save this card to your projects." });
    } catch {
      // If serializing fails, still allow auth flow.
    }

    setLocation("/auth");
  };

  // ─── Export ───────────────────────────────────────────────────────────────
  const exportCard = async (format: "png" | "jpeg" | "svg") => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Enforce backend download policy (free tier daily limits).
    try {
      const trackRes = await apiRequest("POST", "/api/downloads/track");
      const trackData = await trackRes.json();
      if (trackData && trackData.allowed === false) {
        toast({
          title: "Daily limit reached",
          description: "Free accounts can download 3 cards per day. Upgrade to Pro for unlimited downloads.",
          variant: "destructive",
        });
        return;
      }
    } catch {
      toast({
        title: "Could not verify download limit",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
      return;
    }

    const currentZoom = canvas.getZoom();
    const f = (window as any).fabric;
    canvas.setZoom(1);
    prepareCanvasForExport(canvas);

    // Apply watermark to non-Pro exports for consistent policy enforcement.
    let wm: any = null;
    if (!isPro && f?.Text) {
      wm = new f.Text("CardCraft", {
        left: canvas.width - 8,
        top: canvas.height - 8,
        originX: "right",
        originY: "bottom",
        fontSize: Math.round(canvas.width * 0.025),
        fontFamily: "Arial",
        fill: "rgba(255,255,255,0.35)",
        selectable: false,
        evented: false,
        textBaseline: "alphabetic",
      });
      canvas.add(wm);
      canvas.renderAll();
    }

    let href = "";
    let extension = format === "jpeg" ? "jpg" : format;

    try {
      if (format === "svg") {
        const width = Math.round(canvas.width * exportPreset.multiplier);
        const height = Math.round(canvas.height * exportPreset.multiplier);
        let svg = canvas.toSVG({ suppressPreamble: false });
        svg = svg.replace(/<svg([^>]*)>/, (_match: string, attrs: string) => {
          const cleaned = attrs
            .replace(/\swidth="[^"]*"/g, "")
            .replace(/\sheight="[^"]*"/g, "")
            .replace(/\sviewBox="[^"]*"/g, "");
          return `<svg${cleaned} width="${width}" height="${height}" viewBox="0 0 ${canvas.width} ${canvas.height}">`;
        });
        try {
          svg = await applySvgTextMode(svg, svgTextMode);
        } catch (err) {
          console.error("[Editor] SVG text mode failed, exporting raw SVG:", err);
        }
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        href = URL.createObjectURL(blob);
      } else {
        href = canvas.toDataURL({ format, quality: 0.95, multiplier: exportPreset.multiplier });
      }
    } catch (err) {
      console.error("[Editor] Export failed:", err);
      toast({
        title: "Export failed",
        description: "Could not generate the file. Try refreshing the page and exporting again.",
        variant: "destructive",
      });
      if (wm) {
        canvas.remove(wm);
        canvas.renderAll();
      }
      canvas.setZoom(currentZoom);
      return;
    }

    if (wm) {
      canvas.remove(wm);
      canvas.renderAll();
    }

    canvas.setZoom(currentZoom);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${projectTitle.replace(/\s+/g, "-")}-${exportPreset.label.split(" ")[0].toLowerCase()}.${extension}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    if (format === "svg") URL.revokeObjectURL(href);

    const remaining = user && !isPro
      ? `${Math.max(0, 3 - ((user.downloadsToday || 0) + 1))} free downloads remaining today`
      : `${exportPreset.label} exported as ${format.toUpperCase()}.`;

    toast({ title: "Downloaded!", description: remaining });

    trackFeatureEvent("download", {
      pagePath: "/editor",
      action: `export_${format}`,
      resourceType: "project",
      resourceId: projectId ?? undefined,
      meta: { preset: exportPreset.label, format },
    }).catch(() => {});
  };

  // ─── Layers list ──────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<any[]>([]);
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const update = () => setLayers([...canvas.getObjects()].reverse());
    update();
    canvas.on("object:added", update);
    canvas.on("object:removed", update);
    canvas.on("object:modified", update);
    canvas.on("after:render", update);
    return () => {
      canvas.off("object:added", update);
      canvas.off("object:removed", update);
      canvas.off("object:modified", update);
      canvas.off("after:render", update);
    };
  }, [canvasReady]);

  const getLayerLabel = (obj: any) => {
    const cmap: Record<string, string> = { background: "Background", photo_frame: "Photo Frame", greeting: "Greeting", name: "Name", date: "Date", subtitle: "Subtitle", logo: "Logo" };
    if (obj.customType && cmap[obj.customType]) return cmap[obj.customType];
    if (obj.type === "i-text" || obj.type === "text" || obj.type === "textbox") return "Text: " + (obj.text || "").slice(0, 12) + "...";
    if (obj.type === "image") return "Image";
    if (obj.type === "rect") return "Rectangle";
    if (obj.type === "circle") return "Circle";
    return obj.type || "Object";
  };

  // ─── Selected obj properties ──────────────────────────────────────────────
  // ─── Photo frame hint ────────────────────────────────────────────────────────
  const hasPhotoFrame = layers.some((o: any) => o.customType === "photo_frame");
  const hasPhotoImage = layers.some((o: any) => o.customType === "photo_image" || o.customType === "logo_image");
  const showPhotoHint = hasPhotoFrame && !hasPhotoImage;

  const panelSelection = selectedObj ?? selectedObjectRef.current;
  const isText = isTextObject(panelSelection);
  const isImage = panelSelection?.type === "image";
  const imageRx = panelSelection?.rx || 0;
  const textValue = panelSelection?.text || "";
  const textColor = panelSelection?.fill || "#FFFFFF";
  const fontSize = panelSelection?.fontSize || 24;
  const fontFamily = panelSelection?.fontFamily || "Georgia";
  const textAlign = panelSelection?.textAlign || "left";
  const isBold = panelSelection?.fontWeight === "bold";
  const isItalic = panelSelection?.fontStyle === "italic";
  const rawFill = panelSelection?.fill;
  const fillColor = typeof rawFill === "string" ? rawFill : "#FFFFFF"; // Protect against gradient objects
  const isLocked = panelSelection?.selectable === false;
  const opacity = panelSelection?.opacity !== undefined ? Math.round(panelSelection.opacity * 100) : 100;

  const lastTextSelectionRef = useRef<any>(null);
  useEffect(() => {
    if (isText && panelSelection && panelSelection !== lastTextSelectionRef.current) {
      setRightPanelTab("text");
      lastTextSelectionRef.current = panelSelection;
    }
    if (!panelSelection) {
      lastTextSelectionRef.current = null;
    }
  }, [panelSelection, isText]);

  const clearCanvas = () => {
    fabricRef.current?.clear();
    fabricRef.current?.setBackgroundColor("#1a0533", fabricRef.current.renderAll.bind(fabricRef.current));
    setSelectedObj(null);
    saveHistory();
  };

  const editPanelProps: EditorRightPanelProps = {
    tab: rightPanelTab,
    onTabChange: setRightPanelTab,
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
    onSvgTextModeChange: setSvgTextMode,
    onQROpen: () => setQrOpen(true),
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
    onClearCanvas: clearCanvas,
  };

  if (templateId && templateLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <SpinIcon className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (templateId && templateLoadError) {
    const isProTemplate = (templateError as Error & { code?: string })?.code === "PRO_TEMPLATE";
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <Lock size={36} className="text-primary mb-4" />
        <h2 className="text-xl font-bold mb-2">{isProTemplate ? "Pro template" : "Template unavailable"}</h2>
        <p className="text-muted-foreground text-sm max-w-md mb-6">
          {isProTemplate
            ? "This design is part of the Pro template collection. Upgrade to customize and export it."
            : templateError?.message || "We couldn't load this template."}
        </p>
        <div className="flex gap-3">
          <Link href="/templates">
            <Button variant="outline">Back to templates</Button>
          </Link>
          {isProTemplate && (
            <Link href="/pricing">
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Crown size={14} /> Upgrade to Pro
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 sm:px-4 h-13 min-h-[3.25rem] editor-toolbar flex-shrink-0 z-30">
        <div className="flex items-center gap-1.5">
          <Link href="/templates">
            <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm p-1.5 rounded-md hover:bg-secondary" data-testid="button-back">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Templates</span>
            </div>
          </Link>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <input
            className="bg-transparent text-sm font-medium focus:outline-none w-32 sm:w-48 truncate"
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
            aria-label="Project title"
            title="Project title"
            data-testid="input-project-title"
          />
        </div>

        {/* Center: undo/redo + zoom */}
        <div className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground" data-testid="button-undo">
            <Undo2 size={14} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 text-muted-foreground hover:text-foreground" data-testid="button-redo">
            <Redo2 size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={() => zoomTo(Math.max(30, zoomLevel - 25))} title="Zoom out" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoomLevel}%</span>
          <button onClick={() => zoomTo(Math.min(300, zoomLevel + 25))} title="Zoom in" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ZoomIn size={14} />
          </button>
          <button onClick={fitCanvas} title="Fit to view" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Maximize size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={() => setShowGrid(!showGrid)} title={showGrid ? "Hide Gridlines" : "Show Snapping Gridlines"} className={`p-1.5 rounded transition-colors ${showGrid ? 'bg-primary/20 text-primary' : 'hover:bg-secondary text-muted-foreground hover:text-foreground'}`}>
            <Grid3x3 size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => exportCard("png")} className="gap-1.5 text-xs h-8 hidden sm:flex" data-testid="button-export-png">
            <Download size={13} /> PNG
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportCard("jpeg")} className="gap-1.5 text-xs h-8 hidden sm:flex" data-testid="button-export-jpg">
            <Download size={13} /> JPG
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportCard("svg")} className="gap-1.5 text-xs h-8 hidden sm:flex" data-testid="button-export-svg">
            <Download size={13} /> SVG
          </Button>
          {user ? (
            <Button size="sm" onClick={() => saveProject.mutate()} disabled={saveProject.isPending}
              className={`gap-1.5 text-xs h-8 ${isDirty ? "bg-pending hover:bg-pending/90 text-pending-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90"}`} data-testid="button-save">
              <Save size={13} /> {saveProject.isPending ? "Saving..." : isDirty ? "Save*" : "Saved"}
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={savePendingAndAuth}>
              <Save size={13} /> Save
            </Button>
          )}
        </div>
      </header>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-border editor-sidebar flex-shrink-0 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <p className="panel-section-label">Layers</p>
          </div>
          <div className="flex-1 p-2 space-y-0.5 max-h-[38vh] overflow-y-auto">
            {layers.map((obj, i) => (
              <button key={i}
                onClick={() => { fabricRef.current?.setActiveObject(obj); fabricRef.current?.renderAll(); setSelectedObj(obj); }}
                className={`layer-item ${selectedObj === obj ? "layer-item-active text-foreground" : "text-muted-foreground"}`}
                data-testid={`button-layer-${i}`}
              >
                {obj.type === "i-text" || obj.type === "text" || obj.type === "textbox" ? <Type size={10} /> : obj.type === "image" ? <ImageIcon size={10} /> : <Layers size={10} />}
                <span className="truncate">{getLayerLabel(obj)}</span>
                {!obj.selectable && <Lock size={8} className="ml-auto flex-shrink-0 opacity-50" />}
              </button>
            ))}
            {layers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No layers yet</p>}
          </div>
          <div className="p-3 border-t border-border space-y-1.5">
            <p className="panel-section-label mb-2">Add Element</p>
            <button onClick={addText} className="panel-action-btn" data-testid="button-add-text">
              <Type size={12} /> Add Text
            </button>
            <label className={`panel-action-btn cursor-pointer ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <ImageIcon size={12} /> {isUploading ? "Uploading..." : "Add Photo"}
              <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={e => handleImageUpload(e)} data-testid="input-photo-upload" />
            </label>
            <label className={`panel-action-btn cursor-pointer ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={12} /> {isUploading ? "Uploading..." : "Add Logo"}
              <input type="file" accept="image/*" className="hidden" disabled={isUploading} onChange={e => handleImageUpload(e, true)} data-testid="input-logo-upload" />
            </label>
            <button onClick={() => addShape("rect")} className="panel-action-btn">
              <Palette size={12} /> Rectangle
            </button>
            <button onClick={() => addShape("circle")} className="panel-action-btn">
              <Palette size={12} /> Circle
            </button>
            <button onClick={() => addShape("triangle")} className="panel-action-btn">
              <Palette size={12} /> Triangle
            </button>
            <button onClick={() => addShape("star")} className="panel-action-btn">
              <Palette size={12} /> Star (Sticker)
            </button>
            <div className="pt-2 border-t border-border mt-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Emojis</p>
              <div className="grid grid-cols-5 gap-1">
                {EMOJI_PRESETS.map(em => (
                  <button key={em} onClick={() => addEmoji(em)} className="flex items-center justify-center p-1.5 bg-secondary hover:bg-secondary/70 rounded text-xl" title={em}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* ── CANVAS ──────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto canvas-wrap flex items-start justify-center p-3 sm:p-6 lg:p-10 pb-2">
            <div className="shadow-2xl rounded-sm overflow-hidden flex-shrink-0 relative">
              <canvas ref={canvasRef} id="cardcraft-canvas" data-testid="canvas-editor" />
              {/* Dirty indicator dot */}
              {isDirty && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pending shadow" title="Unsaved changes" />
              )}
              {/* Photo frame hint */}
              {showPhotoHint && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="flex items-center gap-1.5 bg-black/60 text-white text-[11px] px-3 py-1.5 rounded-full backdrop-blur-sm">
                    <ImageIcon size={11} />
                    Click "Add Photo" to fill the photo frame
                  </div>
                </div>
              )}
            </div>
          </div>

          <EditorMobileMenu
            panel={mobilePanel}
            onPanelChange={setMobilePanel}
            layers={layers}
            selectedObj={selectedObj}
            getLayerLabel={getLayerLabel}
            onSelectLayer={(obj) => {
              fabricRef.current?.setActiveObject(obj);
              fabricRef.current?.renderAll();
              setSelectedObj(obj);
            }}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            addText={addText}
            addShape={addShape}
            addEmoji={addEmoji}
            handleImageUpload={handleImageUpload}
            isUploading={isUploading}
            zoomLevel={zoomLevel}
            zoomTo={zoomTo}
            fitCanvas={fitCanvas}
            showGrid={showGrid}
            setShowGrid={setShowGrid}
            setBg={setBg}
            exportCard={exportCard}
            isText={isText}
            onOpenEdit={() => setRightPanelTab(isText ? "text" : "style")}
            editPanelProps={editPanelProps}
          />
        </main>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 border-l border-border bg-card flex-shrink-0 overflow-y-auto editor-panel">
          <EditorRightPanel {...editPanelProps} className="flex-1" />
        </aside>
      </div>

      {/* ── QR Code Dialog ────────────────────────────────────────────────── */}
      <QRDialog open={qrOpen} onClose={() => setQrOpen(false)} fabricRef={fabricRef} />
    </div>
  );
}
