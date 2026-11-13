// Downscale a photo in the browser before uploading it for receipt scanning.
// Phone photos are 3-8 MB; a 1600px JPEG is ~200-400 KB and still very readable.

export const MAX_EDGE = 1600

/** Pure: target size that fits within maxEdge on the long side, never upscaling. */
export function computeTargetSize(width, height, maxEdge = MAX_EDGE) {
  const longest = Math.max(width, height)
  if (!longest || longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Browser-only: returns { image: base64 (no prefix), mediaType: 'image/jpeg' }. */
export async function fileToResizedBase64(file, maxEdge = MAX_EDGE, quality = 0.85) {
  const bitmap = await createImageBitmap(file)
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return { image: dataUrl.slice(dataUrl.indexOf(',') + 1), mediaType: 'image/jpeg' }
}
