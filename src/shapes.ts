export type Point = { x: number; y: number };
export type Shape = "circle" | "triangle" | "square" | "star";

export function generateTemplate(
  shape: Shape,
  w: number,
  h: number,
  padding = 24,
): Point[] {
  const box = {
    x: padding,
    y: padding,
    w: Math.max(10, w - padding * 2),
    h: Math.max(10, h - padding * 2),
  };
  const s = Math.min(box.w, box.h);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;

  switch (shape) {
    case "circle":
      return polyCircle(cx, cy, s * 0.45, 96);
    case "triangle":
      return densify(
        close(polyFromVertices(equilateralTriangle(cx, cy, s * 0.85))),
        2,
      );
    case "square":
      return densify(
        close(polyFromVertices(squareVertices(cx, cy, s * 0.85))),
        2,
      );
    case "star":
      return densify(
        close(polyFromVertices(starVertices(cx, cy, s * 0.45, s * 0.2, 5))),
        2,
      );
  }
}

// ---- helpers ----
function polyCircle(cx: number, cy: number, r: number, steps = 64): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(t) * r, y: cy + Math.sin(t) * r });
  }
  return pts;
}
function equilateralTriangle(cx: number, cy: number, size: number): Point[] {
  const r = size / 2;
  const a = -Math.PI / 2;
  return [
    { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r },
    {
      x: cx + Math.cos(a + (2 * Math.PI) / 3) * r,
      y: cy + Math.sin(a + (2 * Math.PI) / 3) * r,
    },
    {
      x: cx + Math.cos(a + (4 * Math.PI) / 3) * r,
      y: cy + Math.sin(a + (4 * Math.PI) / 3) * r,
    },
  ];
}
function squareVertices(cx: number, cy: number, size: number): Point[] {
  const s = size / 2;
  return [
    { x: cx - s, y: cy - s },
    { x: cx + s, y: cy - s },
    { x: cx + s, y: cy + s },
    { x: cx - s, y: cy + s },
  ];
}
function starVertices(
  cx: number,
  cy: number,
  R: number,
  r: number,
  n = 5,
): Point[] {
  const pts: Point[] = [];
  const a0 = -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const A = a0 + (i * 2 * Math.PI) / n;
    const B = A + Math.PI / n;
    pts.push({ x: cx + Math.cos(A) * R, y: cy + Math.sin(A) * R });
    pts.push({ x: cx + Math.cos(B) * r, y: cy + Math.sin(B) * r });
  }
  return pts;
}
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

// 描画用（ゴースト/実線）
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
