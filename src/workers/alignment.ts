import type { CV } from '@techstark/opencv-js/dist/src/types/opencv';

type Mat = InstanceType<CV['Mat']>;

const FEATURE_LONG_EDGE = 900;
const ORB_FEATURES = 3000;
const RATIO_TEST = 0.8;
const MIN_INLIERS = 15;
const MIN_INLIER_RATIO = 0.2;

export interface Alignment {
  /** Capture warped into the baseline frame (grayscale, photometrically matched). */
  alignedGray: Mat;
  /** 255 where the warped capture has real pixels, 0 in the uncovered border. */
  valid: Mat;
  /** Maps capture-frame points into the baseline frame (null = identity). */
  forward: Mat | null;
  /** Maps baseline-frame points back to capture-frame points (null = identity). */
  inverse: Mat | null;
  method: 'homography' | 'identity';
}

function detect(cv: CV, gray: Mat, scale: number) {
  const small = new cv.Mat();
  cv.resize(gray, small, new cv.Size(0, 0), scale, scale, cv.INTER_AREA);
  const orb = new cv.ORB(ORB_FEATURES);
  const kps = new cv.KeyPointVector();
  const des = new cv.Mat();
  const noMask = new cv.Mat();
  try {
    orb.detectAndCompute(small, noMask, kps, des);
  } finally {
    orb.delete();
    small.delete();
    noMask.delete();
  }
  return { kps, des };
}

/** Capture-to-baseline homography; `areaRange` bounds how much of the baseline the capture may cover. */
function estimateHomography(cv: CV, baseGray: Mat, capGray: Mat, areaRange: [number, number] = [0.5, 2]): Mat | null {
  const scale = Math.min(1, FEATURE_LONG_EDGE / Math.max(baseGray.cols, baseGray.rows));
  const b = detect(cv, baseGray, scale);
  const c = detect(cv, capGray, scale);
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false);
  const knn = new cv.DMatchVectorVector();
  try {
    if (b.des.rows < MIN_INLIERS || c.des.rows < MIN_INLIERS) return null;
    matcher.knnMatch(c.des, b.des, knn, 2);
    const src: number[] = [];
    const dst: number[] = [];
    for (let i = 0; i < knn.size(); i += 1) {
      const pair = knn.get(i);
      if (pair.size() < 2) continue;
      const m = pair.get(0);
      const n = pair.get(1);
      if (m.distance >= RATIO_TEST * n.distance) continue;
      const pc = c.kps.get(m.queryIdx).pt;
      const pb = b.kps.get(m.trainIdx).pt;
      src.push(pc.x / scale, pc.y / scale);
      dst.push(pb.x / scale, pb.y / scale);
    }
    const count = src.length / 2;
    if (count < MIN_INLIERS) return null;

    const srcMat = cv.matFromArray(count, 1, cv.CV_32FC2, src);
    const dstMat = cv.matFromArray(count, 1, cv.CV_32FC2, dst);
    const inlierMask = new cv.Mat();
    try {
      const threshold = Math.max(3, 2.5 / scale);
      const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, threshold, inlierMask);
      if (H.empty()) {
        H.delete();
        return null;
      }
      const inliers = cv.countNonZero(inlierMask);
      if (inliers < MIN_INLIERS || inliers / count < MIN_INLIER_RATIO || !isPlausible(H, capGray, baseGray, areaRange)) {
        H.delete();
        return null;
      }
      return H;
    } finally {
      srcMat.delete();
      dstMat.delete();
      inlierMask.delete();
    }
  } finally {
    b.kps.delete();
    b.des.delete();
    c.kps.delete();
    c.des.delete();
    matcher.delete();
    knn.delete();
  }
}

/** Reject degenerate warps: the capture's corners must map to a convex quad of plausible size. */
function isPlausible(H: Mat, capGray: Mat, baseGray: Mat, areaRange: [number, number]): boolean {
  const h = H.data64F;
  const w = capGray.cols;
  const ht = capGray.rows;
  const corners = [
    [0, 0],
    [w, 0],
    [w, ht],
    [0, ht],
  ].map(([x, y]) => {
    const d = h[6] * x + h[7] * y + h[8];
    return d <= 0 ? null : [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
  });
  if (corners.some((p) => p === null)) return false;
  const pts = corners as number[][];
  let area = 0;
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % 4];
    const [x3, y3] = pts[(i + 2) % 4];
    area += x1 * y2 - x2 * y1;
    const cross = Math.sign((x2 - x1) * (y3 - y2) - (y2 - y1) * (x3 - x2));
    if (cross !== 0) {
      if (sign !== 0 && cross !== sign) return false;
      sign = cross;
    }
  }
  const ratio = Math.abs(area / 2) / (baseGray.cols * baseGray.rows);
  return ratio > areaRange[0] && ratio < areaRange[1];
}

/** The live preview may use a narrower or wider lens than the baseline photo. */
const GHOST_AREA_RANGE: [number, number] = [0.04, 4];

/**
 * Where the baseline sits in a live preview frame: a row-major 3x3 homography taking baseline
 * coordinates in [0,1]² to frame coordinates in [0,1]², or null when the frame can't be matched.
 */
export function fitGhostHomography(cv: CV, baseGray: Mat, frameGray: Mat): number[] | null {
  const frameToBase = estimateHomography(cv, baseGray, frameGray, GHOST_AREA_RANGE);
  if (!frameToBase) return null;
  const baseToFrame = new cv.Mat();
  try {
    cv.invert(frameToBase, baseToFrame, cv.DECOMP_SVD);
    const h = Array.from(baseToFrame.data64F);
    const [bw, bh, fw, fh] = [baseGray.cols, baseGray.rows, frameGray.cols, frameGray.rows];
    // diag(1/fw, 1/fh, 1) · H · diag(bw, bh, 1)
    const n = [
      (h[0] * bw) / fw, (h[1] * bh) / fw, h[2] / fw,
      (h[3] * bw) / fh, (h[4] * bh) / fh, h[5] / fh,
      h[6] * bw, h[7] * bh, h[8],
    ];
    return n.map((v) => v / n[8]);
  } finally {
    frameToBase.delete();
    baseToFrame.delete();
  }
}

const PHOTOMETRY_KNOTS = [0.02, 0.1, 0.25, 0.5, 0.75, 0.9, 0.98];
/** Raw values at or above this are treated as blown out (the true value is unknown, only >=). */
export const CLIPPED = 240;

function quantiles(hist: Float64Array, total: number): number[] {
  const out: number[] = [];
  let cdf = 0;
  let v = 0;
  for (const q of PHOTOMETRY_KNOTS) {
    while (v < 255 && cdf + hist[v] < q * total) {
      cdf += hist[v];
      v += 1;
    }
    out.push(v);
  }
  return out;
}

/**
 * Map the capture's tones onto the baseline's with a smooth monotonic curve through matched
 * percentiles (inside `valid`). Absorbs exposure, gamma and highlight clipping without
 * overfitting the way a full histogram match does when scene content changed.
 */
export function matchPhotometry(cv: CV, baseGray: Mat, capGray: Mat, valid: Mat): void {
  const b = baseGray.data;
  const c = capGray.data;
  const m = valid.data;
  const histB = new Float64Array(256);
  const histC = new Float64Array(256);
  let total = 0;
  for (let i = 0; i < m.length; i += 1) {
    if (m[i] === 0) continue;
    histB[b[i]] += 1;
    histC[c[i]] += 1;
    total += 1;
  }
  if (total === 0) return;
  const qB = quantiles(histB, total);
  const qC = quantiles(histC, total);
  const xs = [0];
  const ys = [0];
  qC.forEach((x, i) => {
    if (x > xs[xs.length - 1]) {
      xs.push(x);
      ys.push(Math.max(ys[ys.length - 1], qB[i]));
    }
  });
  if (xs[xs.length - 1] < 255) {
    xs.push(255);
    ys.push(255);
  }
  const lut = new Uint8Array(256);
  let k = 0;
  for (let v = 0; v < 256; v += 1) {
    while (k < xs.length - 2 && v > xs[k + 1]) k += 1;
    const t = (v - xs[k]) / Math.max(1, xs[k + 1] - xs[k]);
    lut[v] = Math.round(ys[k] + t * (ys[k + 1] - ys[k]));
  }
  for (let i = 0; i < c.length; i += 1) c[i] = lut[c[i]];
}

const ILLUM_OFFSET = 10;
const ILLUM_MIN_TRIM = 0.04;
const ILLUM_SAMPLES_PER_SIDE = 135;
const ILLUM_GRID = 8;

/** Solve the 6x6 normal equations (Gaussian elimination with partial pivoting). */
function solve6(a: Float64Array, b: Float64Array): Float64Array | null {
  const n = 6;
  const m = new Float64Array(a);
  const x = new Float64Array(b);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r * n + col]) > Math.abs(m[pivot * n + col])) pivot = r;
    if (Math.abs(m[pivot * n + col]) < 1e-12) return null;
    if (pivot !== col) {
      for (let k = 0; k < n; k += 1) [m[col * n + k], m[pivot * n + k]] = [m[pivot * n + k], m[col * n + k]];
      [x[col], x[pivot]] = [x[pivot], x[col]];
    }
    for (let r = col + 1; r < n; r += 1) {
      const f = m[r * n + col] / m[col * n + col];
      for (let k = col; k < n; k += 1) m[r * n + k] -= f * m[col * n + k];
      x[r] -= f * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = x[r];
    for (let k = r + 1; k < n; k += 1) s -= m[r * n + k] * x[k];
    x[r] = s / m[r * n + r];
  }
  return x;
}

/**
 * Relight `baseGray` in place to the capture's smooth, spatially varying lighting (uneven light,
 * vignetting, white balance drifting across the frame) that a global tone curve cannot match.
 * Fits the capture/baseline brightness ratio with a quadratic surface, ignoring outliers — the
 * moved or removed objects — so real changes are not "corrected" away. The baseline is the one
 * relit so that highlights blown out in the capture clip the same way in both.
 */
export function matchIllumination(
  cv: CV,
  baseGray: Mat,
  capGray: Mat,
  valid: Mat,
  ignore?: Uint8Array,
): void {
  const rows = baseGray.rows;
  const cols = baseGray.cols;
  const b = baseGray.data;
  const c = capGray.data;
  const m = valid.data;
  const step = Math.max(1, Math.round(Math.min(rows, cols) / ILLUM_SAMPLES_PER_SIDE));
  const capacity = Math.ceil(rows / step) * Math.ceil(cols / step);
  const feats = new Float64Array(capacity * 6);
  const targets = new Float64Array(capacity);
  let count = 0;
  for (let y = 0; y < rows; y += step) {
    const v = y / rows - 0.5;
    for (let x = 0; x < cols; x += step) {
      const i = y * cols + x;
      if (m[i] === 0 || ignore?.[i]) continue;
      const u = x / cols - 0.5;
      feats.set([1, u, v, u * u, u * v, v * v], count * 6);
      targets[count] = Math.log((c[i] + ILLUM_OFFSET) / (b[i] + ILLUM_OFFSET));
      count += 1;
    }
  }
  if (count < 50) return;

  const keep = new Uint8Array(count).fill(1);
  const residuals = new Float64Array(count);
  let theta: Float64Array | null = null;
  for (let iter = 0; iter < 4; iter += 1) {
    const ata = new Float64Array(36);
    const atb = new Float64Array(6);
    for (let s = 0; s < count; s += 1) {
      if (!keep[s]) continue;
      const o = s * 6;
      for (let r = 0; r < 6; r += 1) {
        atb[r] += feats[o + r] * targets[s];
        for (let k = r; k < 6; k += 1) ata[r * 6 + k] += feats[o + r] * feats[o + k];
      }
    }
    for (let r = 0; r < 6; r += 1) for (let k = 0; k < r; k += 1) ata[r * 6 + k] = ata[k * 6 + r];
    const next = solve6(ata, atb);
    if (!next) break;
    theta = next;
    let kept = 0;
    for (let s = 0; s < count; s += 1) {
      const o = s * 6;
      let fit = 0;
      for (let k = 0; k < 6; k += 1) fit += feats[o + k] * theta[k];
      residuals[s] = Math.abs(targets[s] - fit);
      if (keep[s]) kept += 1;
    }
    const keptResiduals = new Float64Array(kept);
    for (let s = 0, j = 0; s < count; s += 1) if (keep[s]) keptResiduals[j++] = residuals[s];
    keptResiduals.sort();
    const mad = keptResiduals[Math.floor(kept / 2)] ?? 0;
    const cutoff = Math.max(ILLUM_MIN_TRIM, 3 * 1.4826 * mad);
    for (let s = 0; s < count; s += 1) keep[s] = residuals[s] <= cutoff ? 1 : 0;
  }
  if (!theta) return;

  // The surface is smooth: evaluate it on a coarse grid and interpolate bilinearly.
  const [t0, t1, t2, t3, t4, t5] = theta;
  const gRows = Math.ceil((rows - 1) / ILLUM_GRID) + 1;
  const gCols = Math.ceil((cols - 1) / ILLUM_GRID) + 1;
  const grid = new Float64Array(gRows * gCols);
  for (let gy = 0; gy < gRows; gy += 1) {
    const v = (gy * ILLUM_GRID) / rows - 0.5;
    for (let gx = 0; gx < gCols; gx += 1) {
      const u = (gx * ILLUM_GRID) / cols - 0.5;
      grid[gy * gCols + gx] = Math.exp(t0 + t1 * u + t2 * v + t3 * u * u + t4 * u * v + t5 * v * v);
    }
  }
  for (let y = 0; y < rows; y += 1) {
    const gy = Math.min(gRows - 2, Math.floor(y / ILLUM_GRID));
    const fy = y / ILLUM_GRID - gy;
    const top = gy * gCols;
    const bottom = top + gCols;
    for (let x = 0; x < cols; x += 1) {
      const gx = Math.min(gCols - 2, Math.floor(x / ILLUM_GRID));
      const fx = x / ILLUM_GRID - gx;
      const upper = grid[top + gx] + (grid[top + gx + 1] - grid[top + gx]) * fx;
      const lower = grid[bottom + gx] + (grid[bottom + gx + 1] - grid[bottom + gx]) * fx;
      const gain = upper + (lower - upper) * fy;
      const i = y * cols + x;
      const relit = (b[i] + ILLUM_OFFSET) * gain - ILLUM_OFFSET;
      b[i] = relit < 0 ? 0 : relit > 255 ? 255 : Math.round(relit);
    }
  }
}

function meanAbsDiff(cv: CV, a: Mat, b: Mat, mask: Mat): number {
  const d = new cv.Mat();
  try {
    cv.absdiff(a, b, d);
    return cv.mean(d, mask)[0] ?? 0;
  } finally {
    d.delete();
  }
}

/** Register the capture onto the baseline (same pixel size) and match exposure. */
export function alignCapture(cv: CV, baseGray: Mat, capGray: Mat): Alignment {
  const size = new cv.Size(baseGray.cols, baseGray.rows);
  const full = new cv.Mat(baseGray.rows, baseGray.cols, cv.CV_8UC1, new cv.Scalar(255));

  const identityGray = capGray.clone();
  matchPhotometry(cv, baseGray, identityGray, full);

  const H = estimateHomography(cv, baseGray, capGray);
  if (H) {
    const warped = new cv.Mat();
    const valid = new cv.Mat();
    cv.warpPerspective(capGray, warped, H, size, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0));
    cv.warpPerspective(full, valid, H, size, cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
    const shrink = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    cv.erode(valid, valid, shrink);
    shrink.delete();
    const coverage = cv.countNonZero(valid) / (size.width * size.height);
    if (coverage > 0.5) {
      matchPhotometry(cv, baseGray, warped, valid);
      // Keep the warp only if it actually explains the scene better than no warp.
      if (meanAbsDiff(cv, baseGray, warped, valid) < meanAbsDiff(cv, baseGray, identityGray, valid)) {
        const inverse = new cv.Mat();
        cv.invert(H, inverse, cv.DECOMP_SVD);
        identityGray.delete();
        full.delete();
        return { alignedGray: warped, valid, forward: H, inverse, method: 'homography' };
      }
    }
    warped.delete();
    valid.delete();
    H.delete();
  }
  return { alignedGray: identityGray, valid: full, forward: null, inverse: null, method: 'identity' };
}

/** Warp any capture-frame image (e.g. a color channel) into the baseline frame. */
export function warpToBaseline(cv: CV, image: Mat, alignment: Alignment): Mat {
  if (!alignment.forward) return image.clone();
  const out = new cv.Mat();
  cv.warpPerspective(
    image,
    out,
    alignment.forward,
    new cv.Size(alignment.valid.cols, alignment.valid.rows),
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0),
  );
  return out;
}

/** Map a baseline-frame rect to the capture frame (axis-aligned bounds of the warped corners). */
export function mapRectToCapture(
  inverse: Mat | null,
  rect: { x: number; y: number; width: number; height: number },
  frame: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  if (!inverse) return rect;
  const h = inverse.data64F;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y] of [
    [rect.x, rect.y],
    [rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y + rect.height],
    [rect.x, rect.y + rect.height],
  ]) {
    const d = h[6] * x + h[7] * y + h[8];
    if (d <= 0) return rect;
    xs.push((h[0] * x + h[1] * y + h[2]) / d);
    ys.push((h[3] * x + h[4] * y + h[5]) / d);
  }
  const x0 = Math.max(0, Math.min(...xs));
  const y0 = Math.max(0, Math.min(...ys));
  const x1 = Math.min(frame.width, Math.max(...xs));
  const y1 = Math.min(frame.height, Math.max(...ys));
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
}
