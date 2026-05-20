import opentype from "opentype.js";

export type SvgTextMode = "embed" | "paths";

type FontFaceRule = {
  family: string;
  style: string;
  weight: string;
  srcUrl: string | null;
  format: string | null;
  cssText: string;
};

type FontMap = Map<string, any>;

type StyleMap = Record<string, string>;

const fontFaceCache: { rules: FontFaceRule[] | null; pending: Promise<FontFaceRule[]> | null } = {
  rules: null,
  pending: null,
};

const fontDataCache = new Map<string, string>();
const fontObjectCache: FontMap = new Map();

const SVG_NS = "http://www.w3.org/2000/svg";

const normalizeFamily = (family: string) => family.replace(/['"]/g, "").trim();

const normalizeWeight = (weight?: string) => {
  if (!weight) return 400;
  const w = weight.toLowerCase().trim();
  if (w === "normal") return 400;
  if (w === "bold") return 700;
  const n = parseInt(w, 10);
  return Number.isFinite(n) ? n : 400;
};

const parseStyleAttr = (styleText?: string | null): StyleMap => {
  if (!styleText) return {};
  return styleText.split(";").reduce((acc, part) => {
    const [key, value] = part.split(":");
    if (!key || !value) return acc;
    acc[key.trim()] = value.trim();
    return acc;
  }, {} as StyleMap);
};

const extractFontFamilies = (svg: string) => {
  const families = new Set<string>();
  const attrRe = /font-family="([^"]+)"/g;
  const styleRe = /font-family:\s*([^;\"]+)/g;
  let match: RegExpExecArray | null;
  while ((match = attrRe.exec(svg))) {
    const raw = match[1] || "";
    raw.split(",").forEach((f) => families.add(normalizeFamily(f)));
  }
  while ((match = styleRe.exec(svg))) {
    const raw = match[1] || "";
    raw.split(",").forEach((f) => families.add(normalizeFamily(f)));
  }
  return Array.from(families).filter(Boolean);
};

const parseFontFaceRules = (cssText: string): FontFaceRule[] => {
  const blocks = cssText.match(/@font-face\s*{[^}]*}/g) || [];
  return blocks.map((block) => {
    const familyMatch = block.match(/font-family\s*:\s*['"]?([^;'\"]+)/i);
    const weightMatch = block.match(/font-weight\s*:\s*([^;]+)/i);
    const styleMatch = block.match(/font-style\s*:\s*([^;]+)/i);
    const srcMatch = block.match(/src\s*:\s*([^;]+);?/i);

    let srcUrl: string | null = null;
    let format: string | null = null;

    if (srcMatch?.[1]) {
      const src = srcMatch[1];
      const urlMatches = Array.from(src.matchAll(/url\(([^)]+)\)\s*(?:format\(['"]?([^'\"]+)['"]?\))?/gi));
      const woff2 = urlMatches.find((m) => (m[2] || "").toLowerCase().includes("woff2"));
      const chosen = woff2 || urlMatches[0];
      if (chosen) {
        srcUrl = chosen[1].replace(/['"]/g, "").trim();
        format = chosen[2] ? chosen[2].replace(/['"]/g, "").trim() : null;
      }
    }

    return {
      family: normalizeFamily(familyMatch?.[1] || ""),
      weight: (weightMatch?.[1] || "400").trim(),
      style: (styleMatch?.[1] || "normal").trim(),
      srcUrl,
      format,
      cssText: block,
    };
  }).filter((rule) => rule.family);
};

const readStylesheets = async () => {
  const texts: string[] = [];
  const seen = new Set<string>();

  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (!sheet.cssRules) continue;
      const rulesText = Array.from(sheet.cssRules)
        .filter((rule) => rule.type === CSSRule.FONT_FACE_RULE)
        .map((rule) => rule.cssText)
        .join("\n");
      if (rulesText) texts.push(rulesText);
    } catch {
      if (sheet.href) seen.add(sheet.href);
    }
  }

  const links = Array.from(document.querySelectorAll("link[rel=stylesheet]")) as HTMLLinkElement[];
  for (const link of links) {
    if (!link.href || seen.has(link.href)) continue;
    seen.add(link.href);
    try {
      const res = await fetch(link.href, { cache: "force-cache" });
      if (res.ok) texts.push(await res.text());
    } catch {
      // Ignore stylesheet fetch errors.
    }
  }

  return texts;
};

const getFontFaceRules = async (): Promise<FontFaceRule[]> => {
  if (fontFaceCache.rules) return fontFaceCache.rules;
  if (fontFaceCache.pending) return fontFaceCache.pending;

  fontFaceCache.pending = (async () => {
    const cssTexts = await readStylesheets();
    const rules = cssTexts.flatMap(parseFontFaceRules);
    return rules;
  })();

  const rules = await fontFaceCache.pending;
  fontFaceCache.rules = rules;
  fontFaceCache.pending = null;
  return rules;
};

const toBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]!);
    }
  }
  return btoa(binary);
};

const inlineFontFace = async (rule: FontFaceRule) => {
  if (!rule.srcUrl) return rule.cssText;
  if (!fontDataCache.has(rule.srcUrl)) {
    try {
      const res = await fetch(rule.srcUrl, { cache: "force-cache" });
      if (!res.ok) throw new Error("font fetch failed");
      const buffer = await res.arrayBuffer();
      fontDataCache.set(rule.srcUrl, toBase64(buffer));
    } catch {
      return rule.cssText;
    }
  }

  const base64 = fontDataCache.get(rule.srcUrl);
  if (!base64) return rule.cssText;

  const format = (rule.format || "woff2").toLowerCase();
  const mime = format === "woff2" ? "font/woff2" : format === "woff" ? "font/woff" : "application/octet-stream";

  return `@font-face{font-family:'${rule.family}';font-style:${rule.style};font-weight:${rule.weight};src:url("data:${mime};base64,${base64}") format("${format}");}`;
};

const insertSvgStyle = (svg: string, css: string) => {
  if (!css.trim()) return svg;
  const match = svg.match(/<svg[^>]*>/);
  if (!match || match.index === undefined) return svg;
  const insertAt = match.index + match[0].length;
  const defs = `<defs><style type="text/css"><![CDATA[\n${css}\n]]></style></defs>`;
  return svg.slice(0, insertAt) + defs + svg.slice(insertAt);
};

const embedFonts = async (svg: string) => {
  const families = extractFontFamilies(svg).map((f) => f.toLowerCase());
  if (!families.length) return svg;

  const rules = await getFontFaceRules();
  const matching = rules.filter((rule) => families.includes(rule.family.toLowerCase()) && rule.srcUrl);
  if (!matching.length) return svg;

  const cssBlocks = await Promise.all(matching.map(inlineFontFace));
  return insertSvgStyle(svg, cssBlocks.join("\n"));
};

const pickFontRule = (rules: FontFaceRule[], family: string, weight?: string, style?: string) => {
  const w = normalizeWeight(weight);
  const s = (style || "normal").toLowerCase();
  const familyRules = rules.filter((rule) => rule.family.toLowerCase() === family.toLowerCase());
  const exact = familyRules.find((rule) => normalizeWeight(rule.weight) === w && rule.style.toLowerCase() === s);
  if (exact) return exact;
  const weightMatch = familyRules.find((rule) => normalizeWeight(rule.weight) === w);
  if (weightMatch) return weightMatch;
  const styleMatch = familyRules.find((rule) => rule.style.toLowerCase() === s);
  if (styleMatch) return styleMatch;
  return familyRules[0] || null;
};

const loadFont = async (family: string, weight?: string, style?: string) => {
  const key = `${family}-${weight || "400"}-${style || "normal"}`;
  if (fontObjectCache.has(key)) return fontObjectCache.get(key);

  const rules = await getFontFaceRules();
  const rule = pickFontRule(rules, family, weight, style);
  if (!rule?.srcUrl) return null;

  try {
    const res = await fetch(rule.srcUrl, { cache: "force-cache" });
    if (!res.ok) throw new Error("font fetch failed");
    const buffer = await res.arrayBuffer();
    const font = opentype.parse(buffer);
    fontObjectCache.set(key, font);
    return font;
  } catch {
    return null;
  }
};

const readAttr = (el: Element, name: string, styles: StyleMap) => {
  return el.getAttribute(name) || styles[name] || "";
};

const readNumber = (value: string, fallback = 0) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const applyTextToPath = async (svg: string) => {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
  const textNodes = Array.from(doc.querySelectorAll("text"));
  if (!textNodes.length) return svg;

  for (const textNode of textNodes) {
    const styleMap = parseStyleAttr(textNode.getAttribute("style"));
    const fontFamilyRaw = readAttr(textNode, "font-family", styleMap) || "sans-serif";
    const fontFamily = normalizeFamily(fontFamilyRaw.split(",")[0] || fontFamilyRaw);
    const fontSize = readNumber(readAttr(textNode, "font-size", styleMap), 16);
    const fontWeight = readAttr(textNode, "font-weight", styleMap) || "400";
    const fontStyle = readAttr(textNode, "font-style", styleMap) || "normal";
    const textAnchor = readAttr(textNode, "text-anchor", styleMap) || "start";
    const fill = readAttr(textNode, "fill", styleMap) || "#000";
    const fillOpacity = readAttr(textNode, "fill-opacity", styleMap);
    const stroke = readAttr(textNode, "stroke", styleMap);
    const strokeWidth = readAttr(textNode, "stroke-width", styleMap);
    const strokeOpacity = readAttr(textNode, "stroke-opacity", styleMap);
    const opacity = readAttr(textNode, "opacity", styleMap);
    const lineHeight = readNumber(readAttr(textNode, "line-height", styleMap) || "1.2", 1.2);
    const transform = textNode.getAttribute("transform");

    const font = await loadFont(fontFamily, fontWeight, fontStyle);
    if (!font) continue;

    const parent = textNode.parentNode;
    if (!parent) continue;

    const tspans = Array.from(textNode.querySelectorAll("tspan"));
    const entries: Array<{ text: string; x: number; y: number }> = [];

    if (tspans.length) {
      for (const tspan of tspans) {
        const tspanStyle = { ...styleMap, ...parseStyleAttr(tspan.getAttribute("style")) };
        const x = readNumber(readAttr(tspan, "x", tspanStyle) || readAttr(textNode, "x", styleMap), 0);
        const y = readNumber(readAttr(tspan, "y", tspanStyle) || readAttr(textNode, "y", styleMap), 0);
        entries.push({ text: tspan.textContent || "", x, y });
      }
    } else {
      const x = readNumber(readAttr(textNode, "x", styleMap), 0);
      const y = readNumber(readAttr(textNode, "y", styleMap), 0);
      const lines = (textNode.textContent || "").split(/\n/);
      lines.forEach((line, idx) => {
        entries.push({ text: line, x, y: y + idx * fontSize * lineHeight });
      });
    }

    let converted = false;
    for (const entry of entries) {
      if (!entry.text) continue;
      const advance = font.getAdvanceWidth(entry.text, fontSize);
      let x = entry.x;
      if (textAnchor === "middle") x -= advance / 2;
      if (textAnchor === "end") x -= advance;
      const pathData = font.getPath(entry.text, x, entry.y, fontSize).toPathData(2);
      const pathEl = doc.createElementNS(SVG_NS, "path");
      pathEl.setAttribute("d", pathData);
      pathEl.setAttribute("fill", fill);
      if (fillOpacity) pathEl.setAttribute("fill-opacity", fillOpacity);
      if (stroke) pathEl.setAttribute("stroke", stroke);
      if (strokeWidth) pathEl.setAttribute("stroke-width", strokeWidth);
      if (strokeOpacity) pathEl.setAttribute("stroke-opacity", strokeOpacity);
      if (opacity) pathEl.setAttribute("opacity", opacity);

      if (transform) {
        const g = doc.createElementNS(SVG_NS, "g");
        g.setAttribute("transform", transform);
        g.appendChild(pathEl);
        parent.insertBefore(g, textNode);
      } else {
        parent.insertBefore(pathEl, textNode);
      }
      converted = true;
    }

    if (converted) parent.removeChild(textNode);
  }

  return new XMLSerializer().serializeToString(doc.documentElement);
};

export const applySvgTextMode = async (svg: string, mode: SvgTextMode) => {
  const withTimeout = async <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

  if (mode === "embed") return withTimeout(embedFonts(svg), 5000, svg);
  if (mode === "paths") return withTimeout(applyTextToPath(svg), 5000, svg);
  return svg;
};
