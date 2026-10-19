import type { RefObject } from 'react'
import { gsap, useGSAP } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

export function useAboutPhilosophyMotion(root: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()

  useGSAP(() => {
    const section = root.current
    if (!ready || !section) return

    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const lines = gsap.utils.toArray<HTMLElement>('[data-about-reveal]', section)

      lines.forEach((line, index) => {
        const direction = index % 2 === 0 ? 1 : -1

        gsap.fromTo(line, {
          x: () => window.innerWidth * 0.6 * direction,
          opacity: 0,
        }, {
          x: 0,
          opacity: 1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: line,
            start: 'top bottom',
            end: 'top 45%',
            scrub: 0.2,
            invalidateOnRefresh: true,
          },
        })
      })

      const image = section.querySelector<HTMLElement>('[data-about-philosophy-image]')
      if (!image) return

      gsap.fromTo(image, {
        y: () => window.innerHeight * 0.2,
        opacity: 0,
      }, {
        y: 0,
        opacity: 1,
        ease: 'power1.out',
        scrollTrigger: {
          trigger: image,
          start: 'top bottom',
          end: 'top 40%',
          scrub: 0.2,
          invalidateOnRefresh: true,
        },
      })
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })
}
