import { pixelConfig as config } from './config'

const clamp = (value: number) => Math.max(-config.maxOffset, Math.min(config.maxOffset, value))

/** A few hundred cells; RGBA8 packs two signed 16-bit offsets without float extensions. */
export class DisplacementGrid {
  readonly width: number
  readonly height: number
  readonly offsets: Float32Array
  readonly pixels: Uint8Array

  constructor(aspect: number) {
    const size = config.gridSize * (1 + 2 * config.overflow)
    this.width = Math.max(1, Math.round(size * Math.max(1, aspect)))
    this.height = Math.max(1, Math.round(size * Math.max(1, 1 / aspect)))
    this.offsets = new Float32Array(this.width * this.height * 2)
    this.pixels = new Uint8Array(this.width * this.height * 4)
  }

  update(x: number, y: number, velocityX: number, velocityY: number, ratio: number) {
    const simulationRatio = ratio * config.motionSpeed
    const relaxation = Math.pow(config.relaxation, simulationRatio)
    const moving = Math.abs(velocityX) + Math.abs(velocityY) > 0.00001
    let active = false
    for (let row = 0; row < this.height; row++) {
      for (let column = 0; column < this.width; column++) {
        const index = (row * this.width + column) * 2
        let offsetX = this.offsets[index] * relaxation
        let offsetY = this.offsets[index + 1] * relaxation
        if (moving) {
          const dx = column + 0.5 - x * this.width
          const dy = row + 0.5 - y * this.height
          const distanceSquared = dx * dx + dy * dy
          if (distanceSquared < config.mouseRadius ** 2) {
            const falloff = Math.min(1, (1 - Math.sqrt(distanceSquared) / config.mouseRadius) ** 1.5 * 1.35)
            offsetX = clamp(offsetX + velocityX * simulationRatio * config.strength * falloff)
            offsetY = clamp(offsetY + velocityY * simulationRatio * config.strength * falloff)
          }
        }
        // Below a tenth of a rendered pixel: hand back to the native image.
        if (Math.abs(offsetX) < 0.00005) offsetX = 0
        if (Math.abs(offsetY) < 0.00005) offsetY = 0
        this.offsets[index] = offsetX
        this.offsets[index + 1] = offsetY
        active ||= offsetX !== 0 || offsetY !== 0
        const packedX = Math.round(offsetX / config.maxOffset * 32767) + 32768
        const packedY = Math.round(offsetY / config.maxOffset * 32767) + 32768
        this.pixels[index * 2] = packedX >> 8
        this.pixels[index * 2 + 1] = packedX & 255
        this.pixels[index * 2 + 2] = packedY >> 8
        this.pixels[index * 2 + 3] = packedY & 255
      }
    }
    return active
  }
}
