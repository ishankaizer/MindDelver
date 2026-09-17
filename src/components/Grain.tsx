import { useEffect, useState } from 'react'

/**
 * Film grain over the whole frame, canvas and HUD together. A dark interface
 * rendered in perfectly smooth gradients reads as a slide; a little noise is
 * what makes it read as something photographed. Generated once at runtime so
 * there is no asset to ship and no SVG filter running every frame.
 */
export function Grain() {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const image = ctx.createImageData(size, size)
    for (let i = 0; i < image.data.length; i += 4) {
      // biased toward mid grey so the overlay blend stays neutral
      const v = 110 + Math.random() * 74
      image.data[i] = v
      image.data[i + 1] = v
      image.data[i + 2] = v
      image.data[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
    setUrl(canvas.toDataURL('image/png'))
  }, [])

  if (!url) return null
  return <div className="grain" aria-hidden style={{ backgroundImage: `url(${url})` }} />
}
