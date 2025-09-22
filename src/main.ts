import type { Point, Shape } from "./shapes";
import { generateTemplate, strokePolyline } from "./shapes";

/** ---------- 要素取得 ---------- */
const canvas = document.getElementById("drawCanvas") as HTMLCanvasElement;
const shapeSelect = document.getElementById("shapeSelect") as HTMLSelectElement;
const ghostToggle = document.getElementById("ghostToggle") as HTMLInputElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const scoreBtn = document.getElementById("scoreBtn") as HTMLButtonElement;
const scoreOut = document.getElementById("scoreOut") as HTMLOutputElement;

const ctx = canvas.getContext("2d")!;
let dpr = Math.max(1, window.devicePixelRatio || 1);

// 状態
let shape: Shape = "circle";
let userPath: Point[] = [];
let templatePath: Point[] = [];
let isDrawing = false;
let isCompleted = false;

/** ---------- サイズとDPR対応 ---------- */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  const newDpr = Math.max(1, window.devicePixelRatio || 1);

  if (
    canvas.width !== Math.floor(cssW * newDpr) ||
    canvas.height !== Math.floor(cssH * newDpr)
  ) {
    dpr = newDpr;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }
  // CSS px座標で描けるようにコンテキストをDPRスケール
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** ---------- テンプレ生成 ---------- */
function updateTemplate() {
  const rect = canvas.getBoundingClientRect();
  templatePath = generateTemplate(shape, rect.width, rect.height, 24);
}

/** ---------- レンダリング ---------- */
function render() {
  // クリア（CSS px基準）
  const rect = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, rect.width, rect.height);

  // 背景（任意）
  // ctx.fillStyle = "#ffffff10"; ctx.fillRect(0, 0, rect.width, rect.height);

  // ゴースト
  if (ghostToggle.checked) {
    strokePolyline(ctx, templatePath, {
      color: "#64748b",
      width: 2,
      dash: [6, 8],
      alpha: 0.8,
    });
  }

  // ユーザの線
  strokePolyline(ctx, userPath, { color: "#111827", width: 4, alpha: 1 });
}

/** ---------- 入力（Pointer Events） ---------- */
function getPointFromEvent(ev: PointerEvent): Point {
  const r = canvas.getBoundingClientRect();
  const x = ev.clientX - r.left;
  const y = ev.clientY - r.top;
  return { x, y };
}

function onPointerDown(ev: PointerEvent) {
  if (isCompleted) return; // 一筆書き：完了後はクリアが必要
  isDrawing = true;
  userPath = [getPointFromEvent(ev)];
  canvas.setPointerCapture(ev.pointerId);
  ev.preventDefault();
  render();
}

function onPointerMove(ev: PointerEvent) {
  if (!isDrawing) return;
  userPath.push(getPointFromEvent(ev));
  ev.preventDefault();
  render();
}

function onPointerUp(ev: PointerEvent) {
  if (!isDrawing) return;
  isDrawing = false;
  isCompleted = true;
  if (canvas.hasPointerCapture?.(ev.pointerId)) {
    canvas.releasePointerCapture(ev.pointerId);
  }
  ev.preventDefault();
  render();
}

/** ---------- スコア（暫定） ---------- */
// 正規化して低解像度にレンダリングし、ピクセルIoUで類似度%を返す
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
    const A = a[i] > 0;
    const B = b[i] > 0;
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

/** ---------- クリア ---------- */
function clearAll() {
  userPath = [];
  isDrawing = false;
  isCompleted = false;
  render();
}

/** ---------- 初期化 ---------- */
function init() {
  // リスナ
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  canvas.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp, { passive: false });
  window.addEventListener("pointercancel", onPointerUp, { passive: false });

  // UI
  shapeSelect.addEventListener("change", () => {
    shape = shapeSelect.value as Shape;
    updateTemplate();
    render();
  });
  ghostToggle.addEventListener("change", () => render());
  clearBtn.addEventListener("click", () => clearAll());
  scoreBtn.addEventListener("click", async () => {
    const score = await computeScoreIoU(userPath, templatePath);
    scoreOut.value = Number.isFinite(score) ? `${score.toFixed(1)}%` : "—";
  });

  // リサイズ
  const handleResize = () => {
    resizeCanvas();
    updateTemplate();
    render();
  };
  window.addEventListener("resize", handleResize);
  window.addEventListener("orientationchange", handleResize);

  // 初期
  handleResize();
  scoreOut.value = "—";
}

init();
