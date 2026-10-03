import { useContext, type RefObject } from 'react'
import { gsap, useGSAP } from './gsap'
import { PageRevealContext, useAnimationReady } from './readiness'

/** Opt-in animation. Selectors are restricted to the component's root. */
export function useReveal(scope: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()
  const reveal = useContext(PageRevealContext)
  useGSAP(() => {
    // Replaying a reveal after a native snapshot disappears would hide visible content.
    if (!ready || !reveal) return
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
  }, { scope, dependencies: [ready, reveal], revertOnUpdate: true })
}
