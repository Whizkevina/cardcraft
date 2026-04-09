import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "../components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Download, Save, Upload, Type, Palette, Layers,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ChevronUp, ChevronDown, Lock, Unlock, Trash2,
  Image as ImageIcon, RotateCcw, X, Undo2, Redo2,
  ZoomIn, ZoomOut, Maximize, Wand2, Loader2 as SpinIcon,
  RefreshCw, MousePointer
} from "lucide-react";
import type { Template, Project } from "@shared/schema";
import { SharePanel } from "../components/SharePanel";
import { QRDialog } from "../components/QRDialog";

const FONTS = ["Georgia", "Arial", "Times New Roman", "Trebuchet MS", "Verdana", "Impact", "Great Vibes", "Courier New"];

const BG_PRESETS = [
  { label: "Royal Purple", value: "#1a0533" },
  { label: "Midnight Blue", value: "#0a1628" },
  { label: "Coral", value: "#FF6B6B" },
  { label: "Forest", value: "#1B4332" },
  { label: "Rose Gold", value: "#c0a080" },
  { label: "Pearl White", value: "#FAFAF8" },
  { label: "Charcoal", value: "#2D2D2D" },
  { label: "Sky Blue", value: "#87CEEB" },
  { label: "Plum", value: "#4a1942" },
  { label: "Navy", value: "#0f2744" },
  { label: "Floral Pink", value: "#fdf6f0" },
  { label: "Olive", value: "#3d4f1c" },
];

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
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isHistoryActionRef = useRef(false);

  const [fabricLoaded, setFabricLoaded] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [selectedObj, setSelectedObj] = useState<any>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Card");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [mobilePanel, setMobilePanel] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [exportPreset, setExportPreset] = useState(EXPORT_PRESETS[0]);
  const [isDirty, setIsDirty] = useState(false);
  // ref to track replace-photo input for currently selected image
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);

  const params = useParams<{ templateId?: string; projectId?: string }>();
  const templateId = params.templateId || null;
  const editProjectId = params.projectId || null;

  const { data: template } = useQuery<Template>({
    queryKey: ["/api/templates", templateId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/templates/${templateId}`);
      return res.json();
    },
    enabled: !!templateId,
  });

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", editProjectId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${editProjectId}`);
      return res.json();
    },
    enabled: !!editProjectId,
  });

  // ─── Load Fabric.js ───────────────────────────────────────────────────────
  useEffect(() => {
    if ((window as any).fabric) { setFabricLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js";
    script.onload = () => setFabricLoaded(true);
    document.head.appendChild(script);
  }, []);

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

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0 || !fabricRef.current) return;
    isHistoryActionRef.current = true;
    historyIndexRef.current--;
    const json = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(json, () => {
      fabricRef.current.renderAll();
      isHistoryActionRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || !fabricRef.current) return;
    isHistoryActionRef.current = true;
    historyIndexRef.current++;
    const json = historyRef.current[historyIndexRef.current];
    fabricRef.current.loadFromJSON(json, () => {
      fabricRef.current.renderAll();
      isHistoryActionRef.current = false;
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    });
  }, []);

  // ─── Init canvas ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fabricLoaded || !canvasRef.current || fabricRef.current) return;
    const f = (window as any).fabric;
    const canvas = new f.Canvas(canvasRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: '#111',
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e: any) => setSelectedObj(e.selected?.[0] || null));
    canvas.on("selection:updated", (e: any) => setSelectedObj(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => setSelectedObj(null));
    canvas.on("object:modified", () => { setSelectedObj(canvas.getActiveObject()); saveHistory(); setIsDirty(true); });
    canvas.on("object:added", () => { saveHistory(); setIsDirty(true); });
    canvas.on("object:removed", () => { saveHistory(); setIsDirty(true); });

    // Single-click selects, double-click enters text edit mode
    canvas.on("mouse:dblclick", (opt: any) => {
      const target = opt.target;
      if (target && (target.type === "i-text" || target.type === "text")) {
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
    return () => { canvas.dispose(); fabricRef.current = null; };
  }, [fabricLoaded, saveHistory]);

  // ─── Load template / project ──────────────────────────────────────────────
  useEffect(() => {
    if (!canvasReady || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const f = (window as any).fabric;

    const addObject = (obj: any, fabricObj: any) => {
      if (obj.locked) { fabricObj.selectable = false; fabricObj.evented = false; }
      canvas.add(fabricObj);
    };

    const buildGradient = (gradDef: any, objW: number, objH: number) => {
      if (!gradDef || !f.Gradient) return null;
      try {
        const stops = (gradDef.colorStops || []).map((cs: any) => ({ offset: cs.offset, color: cs.color }));
        if (gradDef.type === 'radial') {
          return new f.Gradient({ type: 'radial', coords: {
            x1: (gradDef.coords?.x1 ?? 0.5) * objW, y1: (gradDef.coords?.y1 ?? 0.5) * objH,
            x2: (gradDef.coords?.x2 ?? 0.5) * objW, y2: (gradDef.coords?.y2 ?? 0.5) * objH,
            r1: (gradDef.coords?.r1 ?? 0) * Math.max(objW, objH),
            r2: (gradDef.coords?.r2 ?? 1) * Math.max(objW, objH),
          }, colorStops: stops });
        }
        return new f.Gradient({ type: 'linear', coords: {
          x1: (gradDef.coords?.x1 ?? 0) * objW, y1: (gradDef.coords?.y1 ?? 0) * objH,
          x2: (gradDef.coords?.x2 ?? 1) * objW, y2: (gradDef.coords?.y2 ?? 0) * objH,
        }, colorStops: stops });
      } catch { return null; }
    };

    const loadJson = (jsonStr: string) => {
      try {
        const data = JSON.parse(jsonStr);
        // Read canvas dimensions from template (default 800x1000 portrait)
        const srcW = data.canvasWidth || 800;
        const srcH = data.canvasHeight || 1000;
        SRC_W = srcW; SRC_H = srcH;

        // Compute display size preserving aspect ratio within max bounds
        const aspect = srcW / srcH;
        if (aspect >= 1) { CANVAS_W = MAX_CANVAS_W; CANVAS_H = Math.round(MAX_CANVAS_W / aspect); }
        else { CANVAS_H = MAX_CANVAS_H; CANVAS_W = Math.round(MAX_CANVAS_H * aspect); }

        canvas.setWidth(CANVAS_W);
        canvas.setHeight(CANVAS_H);
        canvas.clear();

        const scaleX = CANVAS_W / srcW;
        const scaleY = CANVAS_H / srcH;

        if (data.background) canvas.setBackgroundColor(data.background, canvas.renderAll.bind(canvas));
        if (!data.objects) { canvas.renderAll(); return; }

        data.objects.forEach((obj: any) => {
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
            scaleX: obj.scaleX || 1,
            scaleY: obj.scaleY || 1,
          };

          if (obj.fillGradient) s.fill = buildGradient(obj.fillGradient, objW, objH);

          if (obj.type === "rect") {
            addObject(obj, new f.Rect(s));
          } else if (obj.type === "circle") {
            addObject(obj, new f.Circle(s));
          } else if (obj.type === "text" || obj.type === "i-text") {
            // For text with gradient, use solid orange fallback at creation, then apply gradient after render
            const textS = { ...s };
            if (obj.fillGradient) textS.fill = obj.fillGradient.colorStops?.[1]?.color || '#f09820';
            const textObj = new f.IText(obj.text, { ...textS, type: undefined });
            addObject(obj, textObj);
            if (obj.fillGradient) {
              // Apply gradient after object is added and has computed dimensions
              setTimeout(() => {
                const tw = textObj.width || 300;
                const th = textObj.height || 60;
                const tg = buildGradient(obj.fillGradient, tw, th);
                if (tg) { textObj.set('fill', tg); canvas.renderAll(); }
              }, 50);
            }
          } else if (obj.type === "image" && obj.src) {
            f.Image.fromURL(obj.src, (img: any) => {
              img.set({ left: s.left, top: s.top, scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1 });
              if (obj.locked) { img.selectable = false; img.evented = false; }
              canvas.add(img);
              canvas.renderAll();
            }, { crossOrigin: "anonymous" });
          }
        });
        canvas.renderAll();
        setTimeout(() => {
          historyRef.current = [];
          historyIndexRef.current = -1;
          saveHistory();
        }, 200);
      } catch (e) { console.error("Failed to load canvas JSON", e); }
    };

    if (project) {
      setProjectTitle(project.title);
      setProjectId(project.id);
      loadJson(project.designJson);
    } else if (template) {
      setProjectTitle(`${template.title} — ${new Date().toLocaleDateString()}`);
      loadJson(template.canvasJson);
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
        const isTextEditing = active?.type === "i-text" && (active as any).isEditing;
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
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    fabricRef.current.renderAll();
    setSelectedObj({ ...obj });
  };

  const bringForward = () => { fabricRef.current?.getActiveObject()?.bringForward(); fabricRef.current?.renderAll(); };
  const sendBackward = () => { fabricRef.current?.getActiveObject()?.sendBackwards(); fabricRef.current?.renderAll(); };

  const toggleLock = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    const locked = !obj.selectable;
    obj.selectable = locked; obj.evented = locked;
    fabricRef.current?.renderAll();
    setSelectedObj({ ...obj, selectable: locked });
  };

  const deleteSelected = () => {
    const obj = fabricRef.current?.getActiveObject();
    if (!obj) return;
    fabricRef.current?.remove(obj); fabricRef.current?.renderAll(); setSelectedObj(null);
  };

  const addText = () => {
    const f = (window as any).fabric;
    if (!f || !fabricRef.current) return;
    const text = new f.IText("New Text", { left: 80, top: 200, fontSize: 24, fontFamily: "Georgia", fill: "#FFFFFF", textAlign: "center" });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  const addShape = (shape: "rect" | "circle") => {
    const f = (window as any).fabric;
    if (!f || !fabricRef.current) return;
    const obj = shape === "rect"
      ? new f.Rect({ left: 80, top: 180, width: 150, height: 80, fill: "#FFD700", rx: 8, ry: 8 })
      : new f.Circle({ left: 80, top: 180, radius: 60, fill: "#FFD700" });
    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
  };

  const setBg = (color: string) => {
    fabricRef.current?.setBackgroundColor(color, fabricRef.current.renderAll.bind(fabricRef.current));
    saveHistory();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isLogo = false) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
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
          // ── Frame dimensions in canvas coordinates ──
          const fw = (frameObj.width  || 100) * (frameObj.scaleX || 1);
          const fh = (frameObj.height || frameObj.radius ? (frameObj.radius! * 2) : 100) * (frameObj.scaleY || 1);
          const fx = frameObj.left || 0;
          const fy = frameObj.top  || 0;
          const frameAngle = frameObj.angle || 0;

          // Cover-fit: scale image so it fills the frame (like CSS background-size: cover)
          const scaleX = fw / img.width;
          const scaleY = fh / img.height;
          const scale  = Math.max(scaleX, scaleY);

          const scaledW = img.width  * scale;
          const scaledH = img.height * scale;

          // Center the image within the frame
          const offsetX = (scaledW - fw) / 2;
          const offsetY = (scaledH - fh) / 2;

          const fabricImg = new f.Image(img, {
            left: fx - offsetX / scale,
            top:  fy - offsetY / scale,
            scaleX: scale,
            scaleY: scale,
            angle: frameAngle,
            customType: isLogo ? "logo_image" : "photo_image",
          });

          // ── Apply clip path matching the frame's shape ──
          if (frameObj.type === "circle" || (frameObj.rx && frameObj.rx >= (Math.min(frameObj.width || 100, frameObj.height || 100) / 2) * 0.9)) {
            // Circular frame → circular clip
            const clipR = Math.min(fw, fh) / 2 / scale;
            fabricImg.clipPath = new f.Circle({
              radius: clipR,
              left:  -clipR + offsetX / scale,
              top:   -clipR + offsetY / scale,
              absolutePositioned: false,
            });
          } else if (frameObj.rx && frameObj.rx > 4) {
            // Rounded rect frame → rounded clip
            const clipRx = (frameObj.rx * (frameObj.scaleX || 1)) / scale;
            fabricImg.clipPath = new f.Rect({
              width:  fw / scale,
              height: fh / scale,
              rx: clipRx, ry: clipRx,
              left:  offsetX / scale,
              top:   offsetY / scale,
              absolutePositioned: false,
            });
          } else {
            // Plain rect frame → rect clip
            fabricImg.clipPath = new f.Rect({
              width:  fw / scale,
              height: fh / scale,
              left:  offsetX / scale,
              top:   offsetY / scale,
              absolutePositioned: false,
            });
          }

          // Place image just above the frame in the layer stack
          canvas.remove(frameObj);
          canvas.add(fabricImg);
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
      };
      img.src = ev.target?.result as string;
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
    setSelectedObj({ ...obj });
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
      qc.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsDirty(false);
      toast({ title: "Saved!", description: "Your card has been saved." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ─── Export ───────────────────────────────────────────────────────────────
  const exportCard = (format: "png" | "jpeg") => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const currentZoom = canvas.getZoom();
    canvas.setZoom(1);
    const dataURL = canvas.toDataURL({ format, quality: 0.95, multiplier: exportPreset.multiplier });
    canvas.setZoom(currentZoom);
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `${projectTitle.replace(/\s+/g, "-")}-${exportPreset.label.split(" ")[0].toLowerCase()}.${format === "jpeg" ? "jpg" : "png"}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast({ title: "Downloaded!", description: `${exportPreset.label} exported as ${format.toUpperCase()}.` });
  };

  // ─── Layers list ──────────────────────────────────────────────────────────
  const [layers, setLayers] = useState<any[]>([]);
  useEffect(() => {
    if (!fabricRef.current) return;
    const update = () => setLayers([...(fabricRef.current?.getObjects() || [])].reverse());
    const c = fabricRef.current;
    c.on("object:added", update); c.on("object:removed", update);
    c.on("object:modified", update); c.on("after:render", update);
    return () => { c.off("object:added", update); c.off("object:removed", update); };
  }, [canvasReady]);

  const getLayerLabel = (obj: any) => {
    const cmap: Record<string, string> = { background: "Background", photo_frame: "Photo Frame", greeting: "Greeting", name: "Name", date: "Date", subtitle: "Subtitle", logo: "Logo" };
    if (obj.customType && cmap[obj.customType]) return cmap[obj.customType];
    if (obj.type === "i-text" || obj.type === "text") return "Text: " + (obj.text || "").slice(0, 12) + "...";
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

  const isText = selectedObj?.type === "i-text" || selectedObj?.type === "text";
  const isImage = selectedObj?.type === "image";
  const imageRx = selectedObj?.rx || 0;
  const textValue = selectedObj?.text || "";
  const textColor = selectedObj?.fill || "#FFFFFF";
  const fontSize = selectedObj?.fontSize || 24;
  const fontFamily = selectedObj?.fontFamily || "Georgia";
  const textAlign = selectedObj?.textAlign || "left";
  const isBold = selectedObj?.fontWeight === "bold";
  const isItalic = selectedObj?.fontStyle === "italic";
  const fillColor = selectedObj?.fill || "#FFFFFF";
  const isLocked = selectedObj?.selectable === false;
  const opacity = selectedObj?.opacity !== undefined ? Math.round(selectedObj.opacity * 100) : 100;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* ── TOP BAR ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3 sm:px-4 h-12 border-b border-border bg-card flex-shrink-0 z-30">
        <div className="flex items-center gap-1.5">
          <Link href="/templates">
            <a className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors text-sm p-1.5 rounded-md hover:bg-secondary" data-testid="button-back">
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Templates</span>
            </a>
          </Link>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <input
            className="bg-transparent text-sm font-medium focus:outline-none w-32 sm:w-48 truncate"
            value={projectTitle}
            onChange={e => setProjectTitle(e.target.value)}
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
          <button onClick={() => zoomTo(Math.max(30, zoomLevel - 25))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoomLevel}%</span>
          <button onClick={() => zoomTo(Math.min(300, zoomLevel + 25))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <ZoomIn size={14} />
          </button>
          <button onClick={fitCanvas} title="Fit to view" className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <Maximize size={14} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => exportCard("png")} className="gap-1.5 text-xs h-8 hidden sm:flex" data-testid="button-export-png">
            <Download size={13} /> PNG
          </Button>
          <Button size="sm" variant="ghost" onClick={() => exportCard("jpeg")} className="gap-1.5 text-xs h-8 hidden sm:flex" data-testid="button-export-jpg">
            <Download size={13} /> JPG
          </Button>
          {user ? (
            <Button size="sm" onClick={() => saveProject.mutate()} disabled={saveProject.isPending}
              className={`gap-1.5 text-xs h-8 ${isDirty ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`} data-testid="button-save">
              <Save size={13} /> {saveProject.isPending ? "Saving..." : isDirty ? "Save*" : "Saved"}
            </Button>
          ) : (
            <Link href="/auth">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
                <Save size={13} /> Save
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* ── MAIN ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 border-r border-border bg-card flex-shrink-0 overflow-y-auto editor-panel">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Layers</p>
          </div>
          <div className="flex-1 p-2 space-y-0.5">
            {layers.map((obj, i) => (
              <button key={i}
                onClick={() => { fabricRef.current?.setActiveObject(obj); fabricRef.current?.renderAll(); setSelectedObj(obj); }}
                className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 hover:bg-secondary transition-colors ${selectedObj === obj ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                data-testid={`button-layer-${i}`}
              >
                {obj.type === "i-text" || obj.type === "text" ? <Type size={10} /> : obj.type === "image" ? <ImageIcon size={10} /> : <Layers size={10} />}
                <span className="truncate">{getLayerLabel(obj)}</span>
                {!obj.selectable && <Lock size={8} className="ml-auto flex-shrink-0 opacity-50" />}
              </button>
            ))}
            {layers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No layers yet</p>}
          </div>
          <div className="p-3 border-t border-border space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Add Element</p>
            <button onClick={addText} className="w-full text-left text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2" data-testid="button-add-text">
              <Type size={12} /> Add Text
            </button>
            <label className="w-full text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2 cursor-pointer">
              <ImageIcon size={12} /> Add Photo
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e)} data-testid="input-photo-upload" />
            </label>
            <label className="w-full text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2 cursor-pointer">
              <Upload size={12} /> Add Logo
              <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, true)} data-testid="input-logo-upload" />
            </label>
            <button onClick={() => addShape("rect")} className="w-full text-left text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2">
              <Palette size={12} /> Rectangle
            </button>
            <button onClick={() => addShape("circle")} className="w-full text-left text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2">
              <Palette size={12} /> Circle
            </button>
          </div>
        </aside>

        {/* ── CANVAS ──────────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto canvas-wrap flex items-start justify-center p-6 sm:p-10">
            <div className="shadow-2xl rounded-sm overflow-hidden flex-shrink-0 relative">
              <canvas ref={canvasRef} id="cardcraft-canvas" data-testid="canvas-editor" />
              {/* Dirty indicator dot */}
              {isDirty && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-400 shadow" title="Unsaved changes" />
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

          {/* Mobile toolbar */}
          <div className="lg:hidden border-t border-border bg-card px-3 py-2 flex items-center gap-1 overflow-x-auto flex-shrink-0">
            {[
              { icon: Undo2, label: "Undo", action: undo },
              { icon: Redo2, label: "Redo", action: redo },
            ].map(({ icon: Icon, label, action }) => (
              <button key={label} onClick={action} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary">
                <Icon size={15} /><span>{label}</span>
              </button>
            ))}
            <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />
            {[
              { icon: Type, label: "Text", action: addText },
              { icon: ImageIcon, label: "Photo", file: true, isLogo: false },
              { icon: Upload, label: "Logo", file: true, isLogo: true },
              { icon: Palette, label: "Style", action: () => setMobilePanel("style") },
              { icon: Layers, label: "Layers", action: () => setMobilePanel("layers") },
              { icon: Download, label: "Export", action: () => setMobilePanel("export") },
            ].map(({ icon: Icon, label, action, file, isLogo }) => (
              file ? (
                <label key={label} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer">
                  <Icon size={15} /><span>{label}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={e => handleImageUpload(e, isLogo)} />
                </label>
              ) : (
                <button key={label} onClick={action} className="flex-shrink-0 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <Icon size={15} /><span>{label}</span>
                </button>
              )
            ))}
          </div>
        </main>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-64 border-l border-border bg-card flex-shrink-0 overflow-y-auto editor-panel">
          <Tabs defaultValue="style" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b border-border h-10 bg-card">
              <TabsTrigger value="style" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary">Style</TabsTrigger>
              <TabsTrigger value="text" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary" disabled={!isText}>Text</TabsTrigger>
              <TabsTrigger value="export" className="flex-1 text-xs rounded-none data-[state=active]:bg-secondary">Export</TabsTrigger>
            </TabsList>

            {/* ── Style tab ─────────────────────────────────────────────── */}
            <TabsContent value="style" className="flex-1 p-3 space-y-4 mt-0 overflow-y-auto">
              {selectedObj && (
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
                    <Slider min={10} max={100} step={1} value={[opacity]}
                      onValueChange={([v]) => updateSelectedProp("opacity", v / 100)} data-testid="slider-opacity" />
                  </div>

                  {!isImage && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Fill Color</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={fillColor.startsWith("#") ? fillColor : "#FFFFFF"}
                          onChange={e => updateSelectedProp("fill", e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-fill-color" />
                        <span className="text-xs text-muted-foreground">{fillColor}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Image controls ─────────────────────────────── */}
                  {isImage && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Image</p>

                      {/* Replace photo */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Replace Photo</Label>
                        <label className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/70 cursor-pointer transition-colors text-xs" data-testid="label-replace-photo">
                          <RefreshCw size={13} className="text-primary" />
                          Swap Photo
                          <input type="file" accept="image/*" className="hidden" ref={replacePhotoInputRef} onChange={handleReplacePhoto} />
                        </label>
                      </div>

                      {/* Corner radius */}
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Corner Radius</Label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label: "None",   icon: "▭", value: 0 },
                            { label: "Soft",   icon: "▢", value: 15 },
                            { label: "Round",  icon: "⬜", value: 35 },
                            { label: "Circle", icon: "●", value: 50 },
                          ].map(r => {
                            const active =
                              (r.value === 0  && imageRx === 0) ||
                              (r.value === 15 && imageRx > 0 && imageRx < 25) ||
                              (r.value === 35 && imageRx >= 25 && imageRx < 50) ||
                              (r.value === 50 && imageRx >= 50);
                            return (
                              <button key={r.value} onClick={() => setImageBorderRadius(r.value)}
                                title={r.label}
                                className={`py-2 rounded text-xs font-medium transition-colors border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}
                                data-testid={`button-radius-${r.label.toLowerCase()}`}>
                                {r.icon}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Remove background */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Background Removal</Label>
                        <button onClick={removeBackground} disabled={removingBg}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:bg-secondary/70 disabled:opacity-50 transition-colors text-xs"
                          data-testid="button-remove-bg">
                          {removingBg
                            ? <><SpinIcon size={13} className="animate-spin text-primary" /> Removing background...</>
                            : <><Wand2 size={13} className="text-gold" /> Remove Background</>}
                        </button>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">Automatically removes solid or near-solid backgrounds. Works best on plain backdrops.</p>
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
                      style={{ background: bg.value }} data-testid={`button-bg-${bg.label.replace(/\s+/g, "-").toLowerCase()}`} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" defaultValue="#1a0533" onChange={e => setBg(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-bg-color" />
                  <span className="text-xs text-muted-foreground">Custom color</span>
                </div>
              </div>

              <button onClick={() => { fabricRef.current?.clear(); fabricRef.current?.setBackgroundColor("#1a0533", fabricRef.current.renderAll.bind(fabricRef.current)); setSelectedObj(null); saveHistory(); }}
                className="w-full text-xs px-3 py-2 rounded bg-secondary hover:bg-secondary/70 flex items-center gap-2 text-muted-foreground" data-testid="button-reset-canvas">
                <RotateCcw size={12} /> Clear Canvas
              </button>
            </TabsContent>

            {/* ── Text tab ──────────────────────────────────────────────── */}
            <TabsContent value="text" className="flex-1 p-3 space-y-4 mt-0 overflow-y-auto">
              {isText ? (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Text Content</Label>
                    <textarea className="w-full bg-input text-xs p-2 rounded border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      rows={3} value={textValue} onChange={e => updateSelectedProp("text", e.target.value)} data-testid="textarea-text-content" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Font Family</Label>
                    <Select value={fontFamily} onValueChange={v => updateSelectedProp("fontFamily", v)}>
                      <SelectTrigger className="h-8 text-xs" data-testid="select-font-family">
                        <SelectValue>
                          <span style={{ fontFamily }}>{fontFamily}</span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FONTS.map(f => (
                          <SelectItem key={f} value={f}>
                            <span style={{ fontFamily: f }}>{f}</span>
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
                    <input type="color" value={textColor.startsWith("#") ? textColor : "#FFFFFF"}
                      onChange={e => updateSelectedProp("fill", e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent" data-testid="input-text-color" />
                  </div>

                  {/* Text opacity */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Opacity: {opacity}%</Label>
                    <Slider min={10} max={100} step={1} value={[opacity]} onValueChange={([v]) => updateSelectedProp("opacity", v / 100)} />
                  </div>

                  {/* Style buttons */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Style & Alignment</Label>
                    <div className="flex items-center gap-1 flex-wrap">
                      <button onClick={() => updateSelectedProp("fontWeight", isBold ? "normal" : "bold")}
                        className={`p-1.5 rounded border text-xs ${isBold ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`} data-testid="button-bold"><Bold size={12} /></button>
                      <button onClick={() => updateSelectedProp("fontStyle", isItalic ? "normal" : "italic")}
                        className={`p-1.5 rounded border text-xs ${isItalic ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`} data-testid="button-italic"><Italic size={12} /></button>
                      <button onClick={() => updateSelectedProp("textAlign", "left")} className={`p-1.5 rounded border ${textAlign === "left" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignLeft size={12} /></button>
                      <button onClick={() => updateSelectedProp("textAlign", "center")} className={`p-1.5 rounded border ${textAlign === "center" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignCenter size={12} /></button>
                      <button onClick={() => updateSelectedProp("textAlign", "right")} className={`p-1.5 rounded border ${textAlign === "right" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}><AlignRight size={12} /></button>
                    </div>
                  </div>

                  {/* Shadow toggle */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Text Shadow</Label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const obj = fabricRef.current?.getActiveObject();
                          if (!obj) return;
                          const f = (window as any).fabric;
                          if (obj.shadow) { obj.set("shadow", null); }
                          else { obj.set("shadow", new f.Shadow({ color: "rgba(0,0,0,0.5)", blur: 6, offsetX: 2, offsetY: 2 })); }
                          fabricRef.current.renderAll(); setSelectedObj({ ...obj });
                        }}
                        className={`flex-1 text-xs px-2 py-1.5 rounded border ${selectedObj?.shadow ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}
                        data-testid="button-shadow"
                      >
                        {selectedObj?.shadow ? "Shadow On" : "Shadow Off"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Type size={24} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Select a text element to edit</p>
                </div>
              )}
            </TabsContent>

            {/* ── Export & Share tab ───────────────────────────────────── */}
            <TabsContent value="export" className="flex-1 p-3 mt-0 overflow-y-auto">
              <SharePanel fabricRef={fabricRef} projectTitle={projectTitle} projectId={projectId} onQROpen={() => setQrOpen(true)} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>

      {/* ── QR Code Dialog ────────────────────────────────────────────────── */}
      <QRDialog open={qrOpen} onClose={() => setQrOpen(false)} fabricRef={fabricRef} />

      {/* ── MOBILE BOTTOM SHEET ──────────────────────────────────────────── */}
      {mobilePanel && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobilePanel(null)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-2xl flex flex-col"
            style={{ maxHeight: "75vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 border-b border-border">
              <h3 className="font-semibold text-sm capitalize">{mobilePanel}</h3>
              <button onClick={() => setMobilePanel(null)} className="p-1.5 rounded-full hover:bg-secondary"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">

            {mobilePanel === "style" && (
              <div className="space-y-4">
                {isText && (
                  <div className="space-y-2">
                    <Label className="text-xs">Text Content</Label>
                    <textarea className="w-full bg-input text-xs p-2 rounded border border-border focus:outline-none resize-none" rows={2}
                      value={textValue} onChange={e => updateSelectedProp("text", e.target.value)} />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label className="text-xs block mb-1">Font Size: {fontSize}px</Label>
                        <Slider min={8} max={100} step={1} value={[fontSize]} onValueChange={([v]) => updateSelectedProp("fontSize", v)} />
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Label className="text-xs">Color:</Label>
                      <input type="color" value={textColor.startsWith("#") ? textColor : "#fff"}
                        onChange={e => updateSelectedProp("fill", e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border border-border" />
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-xs block mb-2">Background</Label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {BG_PRESETS.map(bg => (
                      <button key={bg.value} onClick={() => { setBg(bg.value); setMobilePanel(null); }}
                        className="w-full aspect-square rounded border border-border hover:scale-110 transition-transform"
                        style={{ background: bg.value }} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mobilePanel === "layers" && (
              <div className="space-y-1">
                {layers.map((obj, i) => (
                  <button key={i} onClick={() => { fabricRef.current?.setActiveObject(obj); fabricRef.current?.renderAll(); setSelectedObj(obj); setMobilePanel(null); }}
                    className="w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 hover:bg-secondary">
                    {obj.type === "i-text" || obj.type === "text" ? <Type size={12} /> : <ImageIcon size={12} />}
                    <span className="truncate">{getLayerLabel(obj)}</span>
                  </button>
                ))}
              </div>
            )}

            {mobilePanel === "export" && (
              <div>
                <SharePanel fabricRef={fabricRef} projectTitle={projectTitle} projectId={projectId} onQROpen={() => { setMobilePanel(null); setQrOpen(true); }} />
              </div>
            )}
            </div>{/* overflow scroll end */}
          </div>
        </div>
      )}
    </div>
  );
}
