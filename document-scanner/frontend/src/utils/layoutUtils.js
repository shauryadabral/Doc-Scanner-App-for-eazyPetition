export function normalizeQuad(quad, width, height) {
  if (!quad || quad.length !== 4) return null
  return quad.map(p => ({
    x: p.x / width,
    y: p.y / height
  }))
}
