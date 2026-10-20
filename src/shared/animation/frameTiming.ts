const referenceFrameDuration = 1000 / 60

/** Keep the same easing on 60 Hz and high refresh rate displays. */
export function getFrameRatio(deltaMilliseconds: number) {
  return Math.min(Math.max(deltaMilliseconds / referenceFrameDuration, 0), 4)
}

export function getSmoothingFactor(amountPerFrame: number, frameRatio: number) {
  return 1 - Math.pow(1 - amountPerFrame, frameRatio)
}
