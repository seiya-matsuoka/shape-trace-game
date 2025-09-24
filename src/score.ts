import type { Point } from "./shapes";

/** ---------- スコア ---------- */
export async function computeScoreIoU(
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

export function normalizeToSquare(
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

export function rasterize(pts: Point[], N: number, stroke: number): Uint8Array {
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
export function chaikin(pts: Point[], iterations = 1): Point[] {
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

export function resampleByLength(pts: Point[], N: number): Point[] {
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
