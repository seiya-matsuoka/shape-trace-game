export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
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
