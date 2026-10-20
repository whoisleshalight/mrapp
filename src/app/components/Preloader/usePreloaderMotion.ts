import { useEffect, useRef, type RefObject } from 'react'
import { gsap, useGSAP } from '@/shared/animation/gsap'
import { motion, prefersReducedMotion } from '@/app/config/motion'
import { createSphereRenderer } from './sphereRenderer'
import { preloader } from './preloader.config'
import type { AssetProgress } from './initialAssets'

type Options = {
  root: RefObject<HTMLDivElement | null>
  canvas: RefObject<HTMLCanvasElement | null>
  counter: RefObject<HTMLSpanElement | null>
  assets: AssetProgress
  onComplete: (ready: boolean) => void
}

export function usePreloaderMotion({ root, canvas, counter, assets, onComplete }: Options) {
  const sequence = useRef<gsap.core.Timeline | null>(null)
  const displayed = useRef({ value: 0 })
  const released = useRef(false)

  useGSAP(() => {
    if (!root.current || !canvas.current) return
    const element = root.current
    const surface = canvas.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pose = { upper: -7, lower: -7 }
    const renderer = query.matches ? null : createSphereRenderer(surface)
    if (renderer) element.setAttribute('data-renderer', 'webgl')
    let active = true
    let elapsed = 0
    const draw = (_time: number, delta: number) => {
      // Some browsers defer media-query events while an eager resource is pending.
      if (query.matches) { disableMotion(); return }
      if (document.hidden || !renderer) return
      const step = Math.min(delta, 50)
      elapsed += step / 1000
      renderer.render(elapsed, pose)
    }
    if (renderer) gsap.ticker.add(draw)
    void document.fonts.ready.then(() => {
      if (active) renderer?.updateTypography()
    })

    const reduced = query.matches || !renderer
    const timeline = gsap.timeline({ onComplete: () => onComplete(true) })
    sequence.current = timeline
    timeline
      .to(pose, { upper: 0.18, duration: reduced ? 0 : preloader.entranceDuration, ease: 'power4.out' }, 0)
      .to(pose, { lower: -0.18, duration: reduced ? 0 : preloader.entranceDuration, ease: 'power4.out' }, reduced ? 0 : preloader.stagger)
      .addLabel('loaded')
      .addPause('loaded')
      .to(pose, {
        lower: -8,
        duration: reduced ? 0 : preloader.exitDuration,
        ease: 'power4.in',
        onStart: () => { element.setAttribute('data-phase', 'exiting') },
      })
      .to(pose, { upper: -8, duration: reduced ? 0 : preloader.exitDuration, ease: 'power4.in' }, reduced ? 'loaded' : `loaded+=${preloader.stagger}`)
      .to(element, { opacity: 0, duration: reduced ? 0 : motion.preloaderDuration, ease: 'power2.inOut' }, reduced ? 'loaded' : `loaded+=${preloader.exitDuration * 0.75}`)

    const disableMotion = () => {
      if (!query.matches) return
      element.removeAttribute('data-renderer')
      surface.style.setProperty('visibility', 'hidden')
      gsap.ticker.remove(draw)
      if (released.current) timeline.progress(1)
      else timeline.pause('loaded')
    }
    const contextLost = () => {
      element.removeAttribute('data-renderer')
      gsap.ticker.remove(draw)
    }
    query.addEventListener('change', disableMotion)
    surface.addEventListener('webglcontextlost', contextLost)

    return () => {
      active = false
      sequence.current = null
      gsap.ticker.remove(draw)
      renderer?.dispose()
      element.removeAttribute('data-renderer')
      surface.style.removeProperty('visibility')
      query.removeEventListener('change', disableMotion)
      surface.removeEventListener('webglcontextlost', contextLost)
      document.body.style.overflow = previousOverflow
    }
  }, { scope: root, dependencies: [onComplete] })

  useEffect(() => {
    const target = counter.current
    if (!target) return
    const tween = gsap.to(displayed.current, {
      value: assets.progress,
      duration: prefersReducedMotion() ? 0 : 0.18,
      ease: 'power1.out',
      onUpdate: () => { target.replaceChildren(String(Math.floor(displayed.current.value))) },
    })
    return () => { tween.kill() }
  }, [assets.progress, counter])

  useGSAP(() => {
    released.current = assets.settled
    const timeline = sequence.current
    if (!assets.settled || !timeline) return
    timeline.removePause('loaded')
    if (prefersReducedMotion()) timeline.progress(1)
    else timeline.play()
  }, { scope: root, dependencies: [assets.settled] })
}
