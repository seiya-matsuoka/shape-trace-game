import { resizeCanvasEl } from "./canvasUtil";
import { drawCrosshair, drawGrid } from "./guides";
import { chaikin, computeScoreIoU, resampleByLength } from "./score";
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

function updateTemplates() {
  const rD = drawCanvas.getBoundingClientRect();
  const rS = sampleCanvas.getBoundingClientRect();
  templatePath = generateTemplate(shape, rD.width, rD.height, 24, sizeKey);
  templateSample = generateTemplate(shape, rS.width, rS.height, 24, sizeKey);
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
