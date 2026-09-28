type Size = { width: number; height: number };

/**
 * Homography placing an element of the baseline's pixel size over an `object-cover` video.
 * `normalized` maps baseline [0,1]² to video-frame [0,1]² (from the vision worker's fitGhost).
 */
export function ghostMatrix(normalized: number[], baseline: Size, video: Size, view: Size): number[] {
  const scale = Math.max(view.width / video.width, view.height / video.height);
  const cw = video.width * scale;
  const ch = video.height * scale;
  const ox = (view.width - cw) / 2;
  const oy = (view.height - ch) / 2;
  const [a, b, c, d, e, f, g, h, i] = normalized;
  // [cw 0 ox; 0 ch oy; 0 0 1] · normalized · diag(1/baseline.width, 1/baseline.height, 1)
  const bx = 1 / baseline.width;
  const by = 1 / baseline.height;
  const m = [
    (cw * a + ox * g) * bx, (cw * b + ox * h) * by, cw * c + ox * i,
    (ch * d + oy * g) * bx, (ch * e + oy * h) * by, ch * f + oy * i,
    g * bx, h * by, i,
  ];
  return m.map((v) => v / m[8]);
}

/** CSS `matrix3d` (column-major 4x4) for a row-major 2D homography; use transform-origin 0 0. */
export function toCssMatrix3d(m: number[]): string {
  return `matrix3d(${[m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, m[8]].join(',')})`;
}
