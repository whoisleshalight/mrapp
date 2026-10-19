import type { RefObject } from 'react'
import { gsap, useGSAP } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

export function useStudioStatementMotion(root: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()

  useGSAP(() => {
    const section = root.current
    if (!ready || !section) return

    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const lines = gsap.utils.toArray<HTMLElement>('[data-statement-line]', section)

      lines.slice(1).forEach((line, index) => {
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

      const details = gsap.utils.toArray<HTMLElement>(
        '[data-statement-note], [data-statement-detail]', section,
      )

      details.forEach((detail) => {
        gsap.fromTo(detail, {
          y: () => Math.min(window.innerHeight * 0.1, 100),
          opacity: 0,
        }, {
          y: 0,
          opacity: 1,
          ease: 'power1.out',
          scrollTrigger: {
            trigger: detail,
            start: 'top bottom',
            end: 'top 70%',
            scrub: 0.2,
            invalidateOnRefresh: true,
          },
        })
      })
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })
}
