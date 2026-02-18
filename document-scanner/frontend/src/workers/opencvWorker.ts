declare function importScripts(...urls: string[]): void;

importScripts("https://docs.opencv.org/4.x/opencv.js");

type WorkerInput = {
  imageData: ImageData;
};

type WorkerOutput = {
  aligned: boolean;
  stabilityScore: number;
  movementVariance: number;
};

let lastCorners: { x: number; y: number }[] | null = null;

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
      aligned: false,
      stabilityScore: 0,
      movementVariance: 0
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
        aligned: false,
        stabilityScore: 0,
        movementVariance: 0
      };
    }

    const corners = best;
    const movementVariance = computeMovementVariance(corners, lastCorners);
    lastCorners = corners;

    const area = polygonArea(corners);
    const frameArea = imageData.width * imageData.height;
    const fillRatio = frameArea > 0 ? area / frameArea : 0;
    const aligned = fillRatio > 0.2 && fillRatio < 0.9;

    const stabilityScore = Math.max(
      0,
      1 - movementVariance / 10
    );

    return {
      aligned,
      stabilityScore,
      movementVariance
    };
  } catch {
    lastCorners = null;
    return {
      aligned: false,
      stabilityScore: 0,
      movementVariance: 0
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
    sum += dx * dx + dy * dy;
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
