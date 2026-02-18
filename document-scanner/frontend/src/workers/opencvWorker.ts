declare function importScripts(...urls: string[]): void;

importScripts("https://docs.opencv.org/4.x/opencv.js");

type WorkerInput = {
  imageData: ImageData;
};

type WorkerOutput = {
  hasContour: boolean;
  aligned: boolean;
  stabilityScore: number;
  movementVariance: number;
  alignmentConfidence: number;
  aspectRatio: number;
  frameCoverage: number;
};

let lastCorners: { x: number; y: number }[] | null = null;
const cornerHistory: { x: number; y: number }[][] = [];
const HISTORY_SIZE = 15;

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = event => {
  const payload = event.data as WorkerInput;
  const result = processFrame(payload.imageData);
  ctx.postMessage(result);
};

function processFrame(imageData: ImageData): WorkerOutput {
  const anySelf = self as any;
  if (!anySelf.cv || !anySelf.cv.Mat) {
    return {
      hasContour: false,
      aligned: false,
      stabilityScore: 0,
      movementVariance: 0,
      alignmentConfidence: 0,
      aspectRatio: 1,
      frameCoverage: 0
    };
  }

  const cv = anySelf.cv as any;

  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(gray, edges, 60, 160, 3, false);

    cv.findContours(
      edges,
      contours,
      hierarchy,
      cv.RETR_LIST,
      cv.CHAIN_APPROX_SIMPLE
    );

    const best = pickBestContour(cv, contours, imageData.width, imageData.height);
    if (!best) {
      lastCorners = null;
      return {
        hasContour: false,
        aligned: false,
        stabilityScore: 0,
        movementVariance: 0,
        alignmentConfidence: 0,
        aspectRatio: 1,
        frameCoverage: 0
      };
    }

    const corners = best;
    const movementVariance = computeMovementVariance(corners, lastCorners);
    lastCorners = corners;

    cornerHistory.push(corners);
    if (cornerHistory.length > HISTORY_SIZE) {
      cornerHistory.shift();
    }

    const area = polygonArea(corners);
    const frameArea = imageData.width * imageData.height;
    const fillRatio = frameArea > 0 ? area / frameArea : 0;
    const aligned = fillRatio > 0.12 && fillRatio < 0.97;

    const alignmentConfidence = Math.max(
      0,
      Math.min(1, (fillRatio - 0.15) / (0.7 - 0.15))
    );

    const stabilityScore = computeStabilityScore();

    const aspectRatio = estimateAspectRatio(corners);

    return {
      hasContour: true,
      aligned,
      stabilityScore,
      movementVariance,
      alignmentConfidence,
      aspectRatio,
      frameCoverage: fillRatio
    };
  } catch {
    lastCorners = null;
    cornerHistory.length = 0;
    return {
      hasContour: false,
      aligned: false,
      stabilityScore: 0,
      movementVariance: 0,
      alignmentConfidence: 0,
      aspectRatio: 1
    };
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function pickBestContour(
  cv: any,
  contours: any,
  width: number,
  height: number
): { x: number; y: number }[] | null {
  let best: { x: number; y: number }[] | null = null;
  let bestArea = 0;
  const minArea = (width * height) * 0.15;

  for (let i = 0; i < contours.size(); i += 1) {
    const contour = contours.get(i);
    const peri = cv.arcLength(contour, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(contour, approx, 0.02 * peri, true);

    if (approx.rows === 4) {
      const area = cv.contourArea(approx);
      if (area > minArea && area > bestArea && cv.isContourConvex(approx)) {
        const points: { x: number; y: number }[] = [];
        for (let j = 0; j < 4; j += 1) {
          const p = approx.intPtr(j);
          points.push({ x: p[0], y: p[1] });
        }
        best = points;
        bestArea = area;
      }
    }
    contour.delete();
  }

  return best;
}

function computeMovementVariance(
  current: { x: number; y: number }[],
  previous: { x: number; y: number }[] | null
): number {
  if (!previous || previous.length !== current.length) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < current.length; i += 1) {
    const dx = current[i].x - previous[i].x;
    const dy = current[i].y - previous[i].y;
    const distSq = dx * dx + dy * dy;
    if (distSq < 25) {
      continue;
    }
    sum += distSq;
  }
  return sum / current.length;
}

function polygonArea(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum / 2);
}

function computeStabilityScore(): number {
  if (cornerHistory.length < 2) {
    return 0;
  }
  const reference = cornerHistory[cornerHistory.length - 1];
  let variance = 0;
  let count = 0;
  for (let i = 0; i < cornerHistory.length - 1; i += 1) {
    const frameCorners = cornerHistory[i];
    if (frameCorners.length !== reference.length) continue;
    for (let j = 0; j < reference.length; j += 1) {
      const dx = frameCorners[j].x - reference[j].x;
      const dy = frameCorners[j].y - reference[j].y;
      variance += dx * dx + dy * dy;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const meanVariance = variance / count;
  const normalized = meanVariance / 100;
  const score = 1 - normalized;
  return Math.max(0, Math.min(1, score));
}

function estimateAspectRatio(corners: { x: number; y: number }[]): number {
  if (corners.length !== 4) return 1;
  const width1 = distance(corners[0], corners[1]);
  const width2 = distance(corners[2], corners[3]);
  const height1 = distance(corners[1], corners[2]);
  const height2 = distance(corners[3], corners[0]);
  const width = (width1 + width2) / 2;
  const height = (height1 + height2) / 2;
  if (height === 0) return 1;
  return height / width;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
