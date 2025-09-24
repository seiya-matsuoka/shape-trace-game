export function resizeCanvasEl(
  cv: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
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
