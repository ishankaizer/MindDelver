// Generates the PWA icon set as plain PNGs, no image library involved.
//
// The reef's own pixel art is generated at runtime on purpose (see the
// README's "no assets are ever shipped" rule) - but that rule is about the
// underwater scene staying procedural, not about app chrome. A PWA icon has
// to exist as a static file before any JS runs, so it is generated once,
// here, and the PNGs are checked in like any other icon would be. Re-run
// this file (`node tools/generate-icons.mjs`) if the icon design changes.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// same water and facet colours as sea.ts / facets.ts, kept in sync by hand
// since this script has no build step of its own to import them through
const TRENCH = '#04101f'
const ABYSS = '#081a33'
const SHALLOW = '#57dce6'
const FOAM = '#E8FBFF'
const FACETS = ['#EADCC8', '#4FD99A', '#FF6F9F', '#FF9247', '#A97BF0', '#DCE85C']

function hex(c) {
  const n = parseInt(c.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const N = 64 // working grid; every exported size is a nearest-neighbour scale of this
const cx = N / 2
const cy = N / 2 + 2

function pixelGrid({ flatBackground = false } = {}) {
  const px = new Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // trench-to-abyss band, two steps, same quantised-gradient feel as the
      // in-scene fog rather than a smooth CSS gradient - skipped for the
      // maskable variant, where the band would show up as a hard-edged
      // rectangle once the OS crops a circle out of the full bleed
      px[y * N + x] = flatBackground ? TRENCH : y < N * 0.58 ? TRENCH : ABYSS
    }
  }

  // six coral limbs, one per facet, radiating from the seed at even angles
  const limbLen = N * 0.34
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 - Math.PI / 2
    const dx = Math.cos(angle)
    const dy = Math.sin(angle) * 0.78 // squashed vertically, same as the sculpture reads front-on
    const color = FACETS[i]
    for (let t = N * 0.1; t <= limbLen; t += 0.5) {
      const x = Math.round(cx + dx * t)
      const y = Math.round(cy + dy * t)
      const r = Math.max(1, Math.round(2.2 - t / limbLen))
      stampDot(px, x, y, r, color)
    }
    // a small blob at the tip, like a node
    stampDot(px, Math.round(cx + dx * limbLen), Math.round(cy + dy * limbLen), 2, color)
  }

  // the bioluminescent seed itself, on top of the limb bases
  stampDot(px, cx, cy, N * 0.15, SHALLOW)
  stampDot(px, cx, cy, N * 0.1, FOAM)

  return px
}

function stampDot(px, cx0, cy0, r, color) {
  const r2 = r * r
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    for (let x = -Math.ceil(r); x <= Math.ceil(r); x++) {
      if (x * x + y * y > r2) continue
      const px_ = cx0 + x
      const py_ = cy0 + y
      if (px_ < 0 || py_ < 0 || px_ >= N || py_ >= N) continue
      px[py_ * N + px_] = color
    }
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1)
    raw[rowStart] = 0 // no filter
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const idat = deflateSync(raw)

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

/** Nearest-neighbour scale from the working grid to any output size, so every
 *  icon stays crisp pixel art rather than blurring like a photo resize would. */
function renderAt(size, { bleed = false } = {}) {
  const grid = pixelGrid({ flatBackground: bleed })
  const rgba = Buffer.alloc(size * size * 4)
  // maskable icons get cropped to a centered circle by the OS, so the design
  // is shrunk into the middle ~65% and the trench colour fills the bleed
  const scale = bleed ? 0.64 : 1
  const offset = (1 - scale) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const gu = (u - offset) / scale
      const gv = (v - offset) / scale
      let color = TRENCH
      if (gu >= 0 && gu < 1 && gv >= 0 && gv < 1) {
        const gx = Math.min(N - 1, Math.floor(gu * N))
        const gy = Math.min(N - 1, Math.floor(gv * N))
        color = grid[gy * N + gx]
      }
      const [r, g, b] = hex(color)
      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = 255
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', renderAt(192))
writeFileSync('public/icons/icon-512.png', renderAt(512))
writeFileSync('public/icons/icon-maskable-512.png', renderAt(512, { bleed: true }))
writeFileSync('public/icons/apple-touch-icon.png', renderAt(180, { bleed: true }))
writeFileSync('public/favicon.png', renderAt(64))

console.log('wrote public/icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png and public/favicon.png')
