export type Point = { x: number; y: number };
export type Shape =
  | "circle"
  | "triangle"
  | "square"
  | "star"
  | "pentagon"
  | "heart";

/**
 * 手本ポリラインを生成
 * @param shape 形状
 * @param w キャンバス幅（CSS px）
 * @param h キャンバス高（CSS px）
 * @param padding 内側余白
 * @param sizeKey "lg" | "sm"（サイズ2段階）
 */
export function generateTemplate(
  shape: Shape,
  w: number,
  h: number,
  padding = 24,
  sizeKey: "lg" | "sm" = "lg",
): Point[] {
  const box = {
    x: padding,
    y: padding,
    w: Math.max(10, w - padding * 2),
    h: Math.max(10, h - padding * 2),
  };
  const s0 = Math.min(box.w, box.h);
  const scale = sizeKey === "lg" ? 0.9 : 0.7;
  const s = s0 * scale;

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  switch (shape) {
    case "circle": {
      const r = s * 0.5 * 0.95;
      return polyCircle(cx, cy, r, 120);
    }
    case "triangle": {
      const verts = equilateralPolygon(cx, cy, s * 0.95, 3, -Math.PI / 2);
      return densify(close(polyFromVertices(verts)), 2);
    }
    case "square": {
      const verts = regularPolygon(cx, cy, s * 0.95, 4, Math.PI / 4);
      return densify(close(polyFromVertices(verts)), 2);
    }
    case "pentagon": {
      const verts = regularPolygon(cx, cy, s * 0.95, 5, -Math.PI / 2);
      return densify(close(polyFromVertices(verts)), 2);
    }
    case "star": {
      const R = s * 0.5 * 0.98;
      const r = R * 0.48;
      const verts = starVertices(cx, cy, R, r, 5, -Math.PI / 2);
      return densify(close(polyFromVertices(verts)), 2);
    }
    case "heart": {
      const pts = heartCurve(180);
      const norm = normalizeToBox(pts, s * 0.95, s * 0.95);
      return translate(norm, cx, cy);
    }
  }
}

/* ---------------- helpers: 形状生成 ---------------- */

function polyCircle(cx: number, cy: number, r: number, steps = 64): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
  return pts;
}

function regularPolygon(
  cx: number,
  cy: number,
  size: number,
  n: number,
  rotation = 0,
): Point[] {
  const R = size / 2;
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const a = rotation + (i * 2 * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  return pts;
}

function equilateralPolygon(
  cx: number,
  cy: number,
  size: number,
  n: number,
  rotation = 0,
): Point[] {
  return regularPolygon(cx, cy, size, n, rotation);
}

function starVertices(
  cx: number,
  cy: number,
  R: number,
  r: number,
  n = 5,
  rotation = 0,
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const A = rotation + (i * 2 * Math.PI) / n;
    const B = A + Math.PI / n;
    pts.push({ x: cx + Math.cos(A) * R, y: cy + Math.sin(A) * R });
    pts.push({ x: cx + Math.cos(B) * r, y: cy + Math.sin(B) * r });
  }
  return pts;
}

// ハート
function heartCurve(steps = 180): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI + (i / steps) * 2 * Math.PI;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y =
      13 * Math.cos(t) -
      5 * Math.cos(2 * t) -
      2 * Math.cos(3 * t) -
      Math.cos(4 * t);
    pts.push({ x, y: -y });
  }
  return pts;
}

/* ---------------- helpers: 幾何・整形 ---------------- */

function polyFromVertices(verts: Point[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % verts.length];
    const steps = 32;
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  return pts;
}

function close(pts: Point[]): Point[] {
  if (pts.length === 0) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first.x !== last.x || first.y !== last.y) pts.push({ ...first });
  return pts;
}

function densify(pts: Point[], factor = 2): Point[] {
  if (factor <= 1) return pts;
  const out: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (let k = 0; k < factor; k++) {
      const u = k / factor;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// 任意座標ポリラインを w×h のボックスに収める
function normalizeToBox(pts: Point[], w: number, h: number): Point[] {
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
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const sx = w / bw;
  const sy = h / bh;
  const s = Math.min(sx, sy);

  // 中心原点化してスケール→左上0,0基準の枠に再配置
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const halfW = w / 2,
    halfH = h / 2;

  return pts.map((p) => ({
    x: (p.x - cx) * s + halfW,
    y: (p.y - cy) * s + halfH,
  }));
}

function translate(pts: Point[], cx: number, cy: number): Point[] {
  return pts.map((p) => ({
    x:
      p.x +
      (cx -
        (0 +
          Math.max(...pts.map((q) => q.x)) +
          Math.min(...pts.map((q) => q.x))) /
          2),
    y:
      p.y +
      (cy -
        (0 +
          Math.max(...pts.map((q) => q.y)) +
          Math.min(...pts.map((q) => q.y))) /
          2),
  }));
}

/* ---------------- 描画 ---------------- */

export function strokePolyline(
  ctx: CanvasRenderingContext2D,
  pts: Point[],
  opt?: {
    color?: string;
    width?: number;
    dash?: number[];
    alpha?: number;
    cap?: CanvasLineCap;
  },
) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = opt?.alpha ?? 1;
  ctx.setLineDash(opt?.dash ?? []);
  ctx.lineCap = opt?.cap ?? "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = opt?.color ?? "#0f172a";
  ctx.lineWidth = opt?.width ?? 3;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}
