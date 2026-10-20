import { pixelConfig as config } from './config'

type Point = [number, number]

function clip(polygon: Point[], axis: 0 | 1, edge: number, direction: number) {
  const result: Point[] = []
  let previous = polygon.at(-1)
  if (!previous) return result
  for (const current of polygon) {
    const inside = (current[axis] - edge) * direction >= 0
    const wasInside = (previous[axis] - edge) * direction >= 0
    if (inside !== wasInside) {
      const ratio = (edge - previous[axis]) / (current[axis] - previous[axis])
      result.push([
        previous[0] + (current[0] - previous[0]) * ratio,
        previous[1] + (current[1] - previous[1]) * ratio,
      ])
    }
    if (inside) result.push(current)
    previous = current
  }
  return result
}

const path = (points: Point[]) => points.length < 3 ? ''
  : `M${points.map(([x, y]) => `${x.toFixed(4)} ${y.toFixed(4)}`).join('L')}Z`

/** Precompute cell holes inside the native photo's outline; no per-frame image masks. */
export function nativeClip(width: number, height: number, cut: number, corners: string, columns: number, rows: number, inset: number) {
  const topLeft = corners.includes('top-left') ? cut : 0
  const bottomRight = corners.includes('bottom-right') ? cut : 0
  const outline: Point[] = [
    [topLeft, 0], [width, 0], [width, height - bottomRight],
    [width - bottomRight, height], [0, height], [0, topLeft],
  ]
  const scale = 1 + 2 * config.overflow
  const cells: string[] = []
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // Keep native color behind the canvas's filtered cell boundary so its
      // translucent edge never exposes a seam to the section background.
      const left = (column / columns * scale - config.overflow) * width + inset
      const right = ((column + 1) / columns * scale - config.overflow) * width - inset
      const top = (row / rows * scale - config.overflow) * height + inset
      const bottom = ((row + 1) / rows * scale - config.overflow) * height - inset
      const points = clip(clip(clip(clip(outline, 0, left, 1), 0, right, -1), 1, top, 1), 1, bottom, -1)
      cells.push(path(points))
    }
  }
  return { outline: path(outline), cells }
}
