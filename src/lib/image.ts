/** Read a picked file and downscale it so uploads stay small on mobile data. */
export async function fileToDataUrl(file: File, maxSize = 1000, quality = 0.82): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  if (file.size > 12 * 1024 * 1024) throw new Error('That image is too large (max 12 MB)')

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file'))
    reader.readAsDataURL(file)
  })

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Could not read that image'))
    element.src = dataUrl
  })

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return dataUrl

  context.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', quality)
}
