import { preloader } from './preloader.config'
import type { SphereOrbit } from './sphereRenderer'

/** Smooth a desktop mouse into camera angles; touch input never steers the loader. */
export function createPointerOrbit() {
  const target: SphereOrbit = { yaw: 0, pitch: 0 }
  const current: SphereOrbit = { yaw: 0, pitch: 0 }
  const reset = () => { target.yaw = 0; target.pitch = 0 }
  const move = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || window.innerWidth <= preloader.pointer.minWidth) return
    const normalize = (position: number, size: number) => Math.max(-1, Math.min(1, position / size * 2 - 1))
    target.yaw = normalize(event.clientX, window.innerWidth) * preloader.pointer.strength
    target.pitch = normalize(event.clientY, window.innerHeight) * preloader.pointer.strength
  }
  const leave = (event: PointerEvent) => {
    if (event.relatedTarget === null) reset()
  }
  window.addEventListener('pointermove', move, { passive: true })
  window.addEventListener('pointerout', leave)
  window.addEventListener('blur', reset)
  window.addEventListener('resize', reset)

  return {
    step(delta: number) {
      // Time-based damping keeps the response consistent at 60 Hz and 120 Hz.
      const blend = 1 - Math.exp(-delta / (preloader.pointer.response * 1000))
      current.yaw += (target.yaw - current.yaw) * blend
      current.pitch += (target.pitch - current.pitch) * blend
      return current
    },
    dispose() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerout', leave)
      window.removeEventListener('blur', reset)
      window.removeEventListener('resize', reset)
    },
  }
}
