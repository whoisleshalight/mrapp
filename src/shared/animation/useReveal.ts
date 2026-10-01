import type { RefObject } from 'react'
import { gsap, useGSAP } from './gsap'
import { useAnimationReady } from './readiness'

/** Opt-in animation. Selectors are restricted to the component's root. */
export function useReveal(scope: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()
  useGSAP(() => {
    if (!ready) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-reveal]', {
        y: 24,
        autoAlpha: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: 'power2.out',
      })
    })
    return () => media.revert()
  }, { scope, dependencies: [ready], revertOnUpdate: true })
}
