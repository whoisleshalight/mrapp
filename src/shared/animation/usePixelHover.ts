import { useEffect, type RefObject } from 'react'
import { createPixelHoverRenderer } from './pixelHoverRenderer'
import { pixelHoverConfig } from './pixelHover.config'

export function usePixelHover(scope: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = scope.current
    if (!root || !pixelHoverConfig.enabled) return
    const media = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    let cleanups: (() => void)[] = []
    const clear = () => {
      cleanups.forEach(cleanup => cleanup())
      cleanups = []
    }
    const sync = () => {
      clear()
      if (!media.matches) return
      root.querySelectorAll<HTMLImageElement>('img[data-pixel-hover]').forEach(image => {
        const target = image.parentElement
        if (!target) return
        let renderer: ReturnType<typeof createPixelHoverRenderer> = null
        let failed = false
        let previous: { x: number; y: number } | null = null
        const reset = () => { previous = null }
        const move = (event: PointerEvent) => {
          if (event.pointerType !== 'mouse' || !image.complete || !image.naturalWidth || failed) return
          const rect = image.getBoundingClientRect()
          if (!rect.width || !rect.height) return
          const x = (event.clientX - rect.left) / rect.width
          const y = (event.clientY - rect.top) / rect.height
          if (previous) {
            renderer ??= createPixelHoverRenderer(image)
            if (!renderer) { failed = true; return }
            const { maxPointerDelta, maxTrailSteps, gridColumns } = pixelHoverConfig
            const dx = Math.max(-maxPointerDelta, Math.min(maxPointerDelta, x - previous.x))
            const dy = Math.max(-maxPointerDelta, Math.min(maxPointerDelta, y - previous.y))
            // Fill fast pointer paths so the distortion leaves a continuous trail.
            const steps = Math.min(maxTrailSteps, Math.max(1, Math.ceil(Math.hypot(x - previous.x, y - previous.y) * gridColumns)))
            for (let step = 1; step <= steps; step++) {
              renderer.move(previous.x + (x - previous.x) * step / steps,
                previous.y + (y - previous.y) * step / steps, dx / steps, dy / steps)
            }
          }
          previous = { x, y }
        }
        target.addEventListener('pointermove', move, { passive: true })
        target.addEventListener('pointerleave', reset)
        image.addEventListener('load', reset)
        cleanups.push(() => {
          target.removeEventListener('pointermove', move)
          target.removeEventListener('pointerleave', reset)
          image.removeEventListener('load', reset)
          renderer?.dispose()
        })
      })
    }
    sync()
    media.addEventListener('change', sync)
    return () => {
      media.removeEventListener('change', sync)
      clear()
    }
  }, [scope])
}
