import type { Point, Shape } from "./shapes";
import { generateTemplate, strokePolyline } from "./shapes";

/** ---------- 要素取得 ---------- */
const drawCanvas = document.getElementById("drawCanvas") as HTMLCanvasElement;
const sampleCanvas = document.getElementById(
  "sampleCanvas",
) as HTMLCanvasElement;

const shapeSelect = document.getElementById("shapeSelect") as HTMLSelectElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;

const toggleGhostBtn = document.getElementById(
  "toggleGhost",
) as HTMLButtonElement;
const toggleGridBtn = document.getElementById(
  "toggleGrid",
) as HTMLButtonElement;
const toggleCrossBtn = document.getElementById(
  "toggleCross",
) as HTMLButtonElement;

const scoreOut = document.getElementById("scoreOut") as HTMLOutputElement;
const scoreBar = document.getElementById("scoreBar") as HTMLDivElement;

const bestOut = document.getElementById("bestOut") as HTMLOutputElement;

const dctx = drawCanvas.getContext("2d")!;
const sctx = sampleCanvas.getContext("2d")!;

const sizeSelect = document.getElementById("sizeSelect") as HTMLSelectElement;

/** ---------- 状態 ---------- */
let shape: Shape = "circle";
let userPath: Point[] = [];
let templatePath: Point[] = []; // 描画エリア用
let templateSample: Point[] = []; // 手本エリア用
let isDrawing = false;
let isCompleted = false;

let showGhost = true;
let showGrid = true;
let showCross = true;

let sizeKey: "lg" | "sm" = "lg";

const SETTINGS_KEY = "stg_settings_v1";
const BEST_PREFIX = "stg_best_v1:";

/** ---------- DPR / リサイズ ---------- */
function resizeCanvasEl(cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const rect = cv.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  const newDpr = Math.max(1, window.devicePixelRatio || 1);

  if (
    cv.width !== Math.floor(cssW * newDpr) ||
    cv.height !== Math.floor(cssH * newDpr)
  ) {
    cv.width = Math.floor(cssW * newDpr);
    cv.height = Math.floor(cssH * newDpr);
  }
  // CSSピクセルで扱えるようにDPR分スケール
  ctx.setTransform(newDpr, 0, 0, newDpr, 0, 0);
}

function updateTemplates() {
  const rD = drawCanvas.getBoundingClientRect();
  const rS = sampleCanvas.getBoundingClientRect();
  templatePath = generateTemplate(shape, rD.width, rD.height, 24, sizeKey);
  templateSample = generateTemplate(shape, rS.width, rS.height, 24, sizeKey);
}

/** ---------- ガイド描画 ---------- */
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const step = Math.max(24, Math.floor(Math.min(w, h) / 12));
  ctx.save();
  ctx.strokeStyle = "rgba(100,116,139,0.12)";
  ctx.lineWidth = 1;
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrosshair(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2,
    cy = h / 2;
  ctx.save();
  ctx.strokeStyle = "rgba(100,116,139,0.22)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();
  ctx.restore();
}

/** ---------- レンダリング ---------- */
function renderDraw() {
  const rect = drawCanvas.getBoundingClientRect();
  dctx.clearRect(0, 0, rect.width, rect.height);

  if (showGrid) drawGrid(dctx, rect.width, rect.height);
  if (showCross) drawCrosshair(dctx, rect.width, rect.height);

  // 手本は細い実線
  if (showGhost) {
    strokePolyline(dctx, templatePath, {
      color: "#94a3b8",
      width: 2,
      alpha: 0.9,
    });
  }

  strokePolyline(dctx, userPath, { color: "#111827", width: 4, alpha: 1 });
}

function renderSample() {
  const rect = sampleCanvas.getBoundingClientRect();
  sctx.clearRect(0, 0, rect.width, rect.height);

  if (showGrid) drawGrid(sctx, rect.width, rect.height);
  if (showCross) drawCrosshair(sctx, rect.width, rect.height);

  strokePolyline(sctx, templateSample, {
    color: "#0f172a",
    width: 3,
    alpha: 1,
  });
}

function renderAll() {
  renderDraw();
  renderSample();
}

/** ---------- 入力（Pointer Events） ---------- */
function getPointFromEvent(ev: PointerEvent): Point {
  const r = drawCanvas.getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function onPointerDown(ev: PointerEvent) {
  if (isCompleted) return;
  isDrawing = true;
  userPath = [getPointFromEvent(ev)];
  drawCanvas.setPointerCapture?.(ev.pointerId);
  ev.preventDefault();
  renderAll();
}

function onPointerMove(ev: PointerEvent) {
  if (!isDrawing) return;
  userPath.push(getPointFromEvent(ev));
  ev.preventDefault();
  renderAll();
}

function onPointerUp(ev: PointerEvent) {
  if (!isDrawing) return;
  isDrawing = false;
  isCompleted = true;
  if (drawCanvas.hasPointerCapture?.(ev.pointerId)) {
    drawCanvas.releasePointerCapture(ev.pointerId);
  }
  ev.preventDefault();
  finalizeAndScore();
  renderAll();
}

/** ---------- スコア ---------- */
async function computeScoreIoU(
  pathA: Point[],
  pathB: Point[],
): Promise<number> {
  if (pathA.length < 2 || pathB.length < 2) return 0;

  const N = 160;
  const STROKE = 10;
  const MARGIN = 12;

  const normA = normalizeToSquare(pathA, N, MARGIN);
  const normB = normalizeToSquare(pathB, N, MARGIN);

  const a = rasterize(normA, N, STROKE);
  const b = rasterize(normB, N, STROKE);

  let inter = 0,
    uni = 0;
  for (let i = 0; i < a.length; i++) {
    const A = a[i] > 0,
      B = b[i] > 0;
    if (A && B) inter++;
    if (A || B) uni++;
  }
  if (uni === 0) return 0;
  return (inter / uni) * 100;
}

function normalizeToSquare(
  pts: Point[],
  size: number,
  margin: number,
): Point[] {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX,
    h = maxY - minY;
  if (w <= 1 || h <= 1) return pts.map(() => ({ x: size / 2, y: size / 2 }));

  const scale = (size - margin * 2) / Math.max(w, h);
  const offX = (size - w * scale) / 2;
  const offY = (size - h * scale) / 2;

  return pts.map((p) => ({
    x: (p.x - minX) * scale + offX,
    y: (p.y - minY) * scale + offY,
  }));
}

function rasterize(pts: Point[], N: number, stroke: number): Uint8Array {
  const cv = document.createElement("canvas");
  cv.width = N;
  cv.height = N;
  const c = cv.getContext("2d")!;
  c.clearRect(0, 0, N, N);
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = stroke;
  c.strokeStyle = "#000";
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.stroke();
  const img = c.getImageData(0, 0, N, N).data;
  const out = new Uint8Array(N * N);
  for (let i = 0, j = 0; i < img.length; i += 4, j++) out[j] = img[i + 3];
  return out;
}

/** ---------- スムージング＆リサンプリング ---------- */
function chaikin(pts: Point[], iterations = 1): Point[] {
  if (pts.length < 3) return pts.slice();
  let out = pts.slice();
  for (let it = 0; it < iterations; it++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i],
        b = out[i + 1];
      const Q = { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 };
      const R = { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 };
      next.push(Q, R);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

function resampleByLength(pts: Point[], N: number): Point[] {
  if (pts.length === 0) return [];
  if (pts.length === 1) return [pts[0]];
  const d: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    d[i] =
      d[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  const total = d[d.length - 1] || 1;
  const out: Point[] = new Array(N);
  let j = 0;
  for (let k = 0; k < N; k++) {
    const t = (k / (N - 1)) * total;
    while (j < d.length - 1 && d[j + 1] < t) j++;
    const a = pts[j],
      b = pts[Math.min(j + 1, pts.length - 1)];
    const seg = d[Math.min(j + 1, d.length - 1)] - d[j] || 1;
    const u = Math.max(0, Math.min(1, (t - d[j]) / seg));
    out[k] = { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
  }
  return out;
}

/** ---------- スコア/クリア/UI ---------- */
function updateScoreUI(score: number | null) {
  if (score == null || !Number.isFinite(score)) {
    scoreOut.value = "—";
    scoreBar.style.width = "0%";
    scoreBar.style.backgroundColor = "hsl(220 15% 60%)";
    return;
  }
  const pct = Math.max(0, Math.min(100, score));
  scoreOut.value = `${pct.toFixed(1)}%`;
  const hue = Math.round((pct / 100) * 120);
  scoreBar.style.width = `${pct}%`;
  scoreBar.style.backgroundColor = `hsl(${hue} 90% 45%)`;
}

function clearAll() {
  userPath = [];
  isDrawing = false;
  isCompleted = false;
  updateScoreUI(null);
  renderAll();
}

function finalizeAndScore() {
  const smoothed = chaikin(userPath, 1);
  const resampled = resampleByLength(smoothed, 256);
  userPath = resampled;

  computeScoreIoU(userPath, templatePath).then((score) => {
    updateScoreUI(score);

    if (Number.isFinite(score)) {
      updateBestIfGreater(score);
      updateBestUI();
    }
  });
}

function bestKeyForCurrent(): string {
  // サイズは無視
  return `${BEST_PREFIX}${shape}|g${Number(showGhost)}|gr${Number(showGrid)}|c${Number(showCross)}`;
}

function loadBest(): number | null {
  const raw = localStorage.getItem(bestKeyForCurrent());
  const val = raw != null ? Number(raw) : NaN;
  return Number.isFinite(val) ? val : null;
}

function updateBestIfGreater(score: number) {
  const current = loadBest();
  if (current == null || score > current) {
    localStorage.setItem(bestKeyForCurrent(), String(score));
  }
}

function updateBestUI() {
  const b = loadBest();
  bestOut.value = b == null ? "—" : `${b.toFixed(1)}%`;
}

type SavedSettings = {
  shape: Shape;
  sizeKey: "lg" | "sm";
  showGhost: boolean;
  showGrid: boolean;
  showCross: boolean;
};

function saveSettings() {
  const data: SavedSettings = {
    shape,
    sizeKey,
    showGhost,
    showGrid,
    showCross,
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
}

function loadSettings(): SavedSettings | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<SavedSettings>;
    const s = (obj.shape as Shape) ?? "circle";
    const sz = (obj.sizeKey === "sm" ? "sm" : "lg") as "lg" | "sm";
    return {
      shape: s,
      sizeKey: sz,
      showGhost: !!obj.showGhost,
      showGrid: !!obj.showGrid,
      showCross: !!obj.showCross,
    };
  } catch {
    return null;
  }
}

/** ---------- トグルUI ---------- */
function setToggleStyle(btn: HTMLButtonElement, active: boolean) {
  btn.setAttribute("aria-pressed", String(active));
  btn.classList.toggle("bg-slate-900", active);
  btn.classList.toggle("text-white", active);
  btn.classList.toggle("bg-white", !active);
  btn.classList.toggle("text-slate-700", !active);
  btn.classList.toggle("border", !active);
  btn.classList.toggle("border-slate-300", !active);
  btn.classList.toggle("dark:bg-slate-800", !active);
  btn.classList.toggle("dark:text-slate-200", !active);
  btn.classList.toggle("dark:border-slate-700", !active);
}

/** ---------- 初期化 ---------- */
function init() {
  // 入力
  drawCanvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  drawCanvas.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });
  window.addEventListener("pointercancel", onPointerUp, { passive: false });

  // UI
  shapeSelect.addEventListener("change", () => {
    shape = shapeSelect.value as Shape;
    updateTemplates();
    saveSettings();
    clearAll();
    updateBestUI();
  });

  sizeSelect.addEventListener("change", () => {
    sizeKey = (sizeSelect.value as "lg" | "sm") ?? "lg";
    updateTemplates();
    saveSettings();
    clearAll();
    updateBestUI();
  });

  clearBtn.addEventListener("click", () => {
    clearAll();
  });

  toggleGhostBtn.addEventListener("click", () => {
    showGhost = !showGhost;
    setToggleStyle(toggleGhostBtn, showGhost);
    saveSettings();
    renderAll();
    updateBestUI();
  });

  toggleGridBtn.addEventListener("click", () => {
    showGrid = !showGrid;
    setToggleStyle(toggleGridBtn, showGrid);
    saveSettings();
    renderAll();
    updateBestUI();
  });

  toggleCrossBtn.addEventListener("click", () => {
    showCross = !showCross;
    setToggleStyle(toggleCrossBtn, showCross);
    saveSettings();
    renderAll();
    updateBestUI();
  });

  // 設定復元
  const loaded = loadSettings();
  if (loaded) {
    shape = loaded.shape;
    sizeKey = loaded.sizeKey;
    showGhost = loaded.showGhost;
    showGrid = loaded.showGrid;
    showCross = loaded.showCross;

    // UIに反映
    shapeSelect.value = shape;
    sizeSelect.value = sizeKey;
    setToggleStyle(toggleGhostBtn, showGhost);
    setToggleStyle(toggleGridBtn, showGrid);
    setToggleStyle(toggleCrossBtn, showCross);
  }

  // リサイズ
  const handleResize = () => {
    resizeCanvasEl(drawCanvas, dctx);
    resizeCanvasEl(sampleCanvas, sctx);
    updateTemplates();
    renderAll();
  };
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  // キャンバス親のサイズが変わったら描画領域を再計算
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => {
      resizeCanvasEl(drawCanvas, dctx);
      resizeCanvasEl(sampleCanvas, sctx);
      updateTemplates();
      renderAll();
    });
    if (drawCanvas.parentElement) ro.observe(drawCanvas.parentElement);
    if (sampleCanvas.parentElement) ro.observe(sampleCanvas.parentElement);
  }

  // 初期
  handleResize();
  setToggleStyle(toggleGhostBtn, showGhost);
  setToggleStyle(toggleGridBtn, showGrid);
  setToggleStyle(toggleCrossBtn, showCross);
  updateScoreUI(null);
  updateBestUI();
}

init();
