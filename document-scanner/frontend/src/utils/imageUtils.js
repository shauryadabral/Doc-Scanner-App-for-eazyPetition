export function resizeImageDataToMaxDimension(imageData, maxDimension) {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  canvas.width = imageData.width
  canvas.height = imageData.height
  ctx.putImageData(imageData, 0, 0)
  const ratio = Math.min(
    maxDimension / canvas.width,
    maxDimension / canvas.height,
    1
  )
  const targetWidth = Math.round(canvas.width * ratio)
  const targetHeight = Math.round(canvas.height * ratio)
  const targetCanvas = document.createElement("canvas")
  const targetCtx = targetCanvas.getContext("2d")
  targetCanvas.width = targetWidth
  targetCanvas.height = targetHeight
  targetCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight)
  const resizedData = targetCtx.getImageData(0, 0, targetWidth, targetHeight)
  return resizedData
}

export function dataUrlFromImageData(imageData, type = "image/jpeg", quality = 0.9) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext("2d")
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL(type, quality)
}
