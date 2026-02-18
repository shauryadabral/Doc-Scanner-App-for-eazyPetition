importScripts("/opencv.js")

let cvReady = false
let lastGray = null
let movementHistory = []

self.Module = {
  onRuntimeInitialized() {
    cvReady = true
  }
}

function toMat(width, height, buffer) {
  const img = new ImageData(new Uint8ClampedArray(buffer), width, height)
  const mat = cv.matFromImageData(img)
  return mat
}

function largestQuadFromContours(contours) {
  let bestQuad = null
  let bestArea = 0
  for (let i = 0; i < contours.size(); i++) {
    const c = contours.get(i)
    const peri = cv.arcLength(c, true)
    const approx = new cv.Mat()
    cv.approxPolyDP(c, approx, 0.02 * peri, true)
    if (approx.rows === 4) {
      const pts = []
      for (let j = 0; j < 4; j++) {
        const p = approx.intPtr(j, 0)
        pts.push({ x: p[0], y: p[1] })
      }
      let minX = pts[0].x
      let minY = pts[0].y
      let maxX = pts[0].x
      let maxY = pts[0].y
      for (let k = 1; k < pts.length; k++) {
        const p = pts[k]
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      const area = (maxX - minX) * (maxY - minY)
      if (area > bestArea) {
        bestArea = area
        bestQuad = pts
      }
    }
  }
  return bestQuad
}

function computeCenter(quad) {
  const cx = quad.reduce((sum, p) => sum + p.x, 0) / quad.length
  const cy = quad.reduce((sum, p) => sum + p.y, 0) / quad.length
  return { x: cx, y: cy }
}

function analyzeFrame(width, height, buffer) {
  if (!cvReady) return null
  const src = toMat(width, height, buffer)
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  const blurred = new cv.Mat()
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
  const edges = new cv.Mat()
  cv.Canny(blurred, edges, 50, 150)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE
  )

  const quad = largestQuadFromContours(contours)
  let diffValue = 0
  if (lastGray) {
    const diff = new cv.Mat()
    cv.absdiff(gray, lastGray, diff)
    const mean = cv.mean(diff)
    diffValue = mean[0]
    diff.delete()
  }
  if (lastGray) {
    lastGray.delete()
  }
  lastGray = gray.clone()

  let aligned = false
  if (quad) {
    const center = computeCenter(quad)
    const marginX = width * 0.1
    const marginY = height * 0.1
    aligned =
      center.x > marginX &&
      center.x < width - marginX &&
      center.y > marginY &&
      center.y < height - marginY
  }

  const movementDelta = Math.abs(diffValue)
  movementHistory.push(movementDelta)
  if (movementHistory.length > 20) {
    movementHistory.shift()
  }
  let movementVar = 0
  if (movementHistory.length > 1) {
    const mean =
      movementHistory.reduce((s, v) => s + v, 0) /
      movementHistory.length
    movementVar =
      movementHistory.reduce((s, v) => s + (v - mean) * (v - mean), 0) /
      movementHistory.length
  }

  src.delete()
  gray.delete()
  blurred.delete()
  edges.delete()
  contours.delete()
  hierarchy.delete()

  const corners = quad
    ? quad.map(p => ({ x: p.x, y: p.y }))
    : null

  return {
    aligned,
    corners,
    stability_score: diffValue,
    movement_variance: movementVar
  }
}

function orderQuad(quad) {
  if (!quad || quad.length !== 4) return null
  const sorted = quad.slice().sort((a, b) => a.y - b.y)
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x)
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x)
  return [top[0], top[1], bottom[1], bottom[0]]
}

function warpDocument(width, height, buffer) {
  if (!cvReady) return null
  const src = toMat(width, height, buffer)
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  const blurred = new cv.Mat()
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)
  const edges = new cv.Mat()
  cv.Canny(blurred, edges, 50, 150)
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(
    edges,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE
  )
  const quad = largestQuadFromContours(contours)
  if (!quad) {
    src.delete()
    gray.delete()
    blurred.delete()
    edges.delete()
    contours.delete()
    hierarchy.delete()
    return null
  }
  const ordered = orderQuad(quad)
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    ordered[0].x,
    ordered[0].y,
    ordered[1].x,
    ordered[1].y,
    ordered[2].x,
    ordered[2].y,
    ordered[3].x,
    ordered[3].y
  ])
  const widthA = Math.hypot(
    ordered[2].x - ordered[3].x,
    ordered[2].y - ordered[3].y
  )
  const widthB = Math.hypot(
    ordered[1].x - ordered[0].x,
    ordered[1].y - ordered[0].y
  )
  const maxWidth = Math.max(widthA, widthB)
  const heightA = Math.hypot(
    ordered[1].x - ordered[2].x,
    ordered[1].y - ordered[2].y
  )
  const heightB = Math.hypot(
    ordered[0].x - ordered[3].x,
    ordered[0].y - ordered[3].y
  )
  const maxHeight = Math.max(heightA, heightB)
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    maxWidth - 1,
    0,
    maxWidth - 1,
    maxHeight - 1,
    0,
    maxHeight - 1
  ])
  const M = cv.getPerspectiveTransform(srcTri, dstTri)
  const dst = new cv.Mat()
  const dsize = new cv.Size(maxWidth, maxHeight)
  cv.warpPerspective(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_REPLICATE)

  const outWidth = dst.cols
  const outHeight = dst.rows
  const outData = new Uint8ClampedArray(dst.data)

  src.delete()
  gray.delete()
  blurred.delete()
  edges.delete()
  contours.delete()
  hierarchy.delete()
  srcTri.delete()
  dstTri.delete()
  M.delete()
  dst.delete()

  return {
    width: outWidth,
    height: outHeight,
    data: outData.buffer
  }
}

self.onmessage = e => {
  const msg = e.data
  if (msg.type === "ANALYZE_FRAME") {
    if (!cvReady) return
    const res = analyzeFrame(msg.width, msg.height, msg.data)
    if (!res) return
    self.postMessage({
      type: "ANALYSIS_RESULT",
      aligned: res.aligned,
      corners: res.corners,
      stability_score: res.stability_score,
      movement_variance: res.movement_variance,
      width: msg.width,
      height: msg.height
    })
  } else if (msg.type === "PROCESS_CAPTURE") {
    if (!cvReady) return
    const warped = warpDocument(msg.width, msg.height, msg.data)
    if (!warped) return
    self.postMessage(
      {
        type: "CAPTURE_RESULT",
        width: warped.width,
        height: warped.height,
        data: warped.data
      },
      [warped.data]
    )
  }
}
