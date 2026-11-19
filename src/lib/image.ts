/**
 * Client-side image preparation for food photo uploads.
 * Resizes to a small JPEG data URL so it can be stored in the `image_url`
 * column without any paid storage service. Swap this for Supabase Storage
 * in production (see README) — the rest of the app only needs a URL string.
 */
export async function fileToCompressedDataUrl(file: File, maxSize = 720, quality = 0.75): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG or WebP)')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Image is too large. Please use a photo under 12 MB.')
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that image'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode that image'))
    img.src = dataUrl
  })

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image processing is not supported in this browser')
  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
