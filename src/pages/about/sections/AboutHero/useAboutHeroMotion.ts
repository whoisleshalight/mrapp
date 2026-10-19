import type { RefObject } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

export function useAboutHeroMotion(root: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()

  useGSAP(() => {
    if (!ready || !root.current) return

    const stage = root.current.querySelector<HTMLElement>('[data-about-hero-stage]')
    const passages = Array.from(root.current.querySelectorAll<HTMLElement>('[data-about-passage]'))
    const gesture = root.current.querySelector<HTMLElement>('[data-about-hero-image="gesture"]')
    const coffee = root.current.querySelector<HTMLElement>('[data-about-hero-image="coffee"]')
    const arrow = root.current.querySelector<HTMLElement>('[data-about-hero-arrow]')
    if (!stage || passages.length !== 3 || !gesture || !coffee || !arrow) return

    const media = gsap.matchMedia()
    media.add({
      motion: '(prefers-reduced-motion: no-preference)',
      mobile: '(max-width: 767px)',
      desktop: '(min-width: 768px)',
    }, (context) => {
      if (!context.conditions?.motion) return

      const mobile = Boolean(context.conditions.mobile)
      stage.dataset.animated = 'true'

      // Viewport units include the scrollbar; use the same width for all image travel.
      const imageHeight = (width: number, aspect: number) => window.innerWidth * width * aspect
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => `+=${window.innerHeight * (mobile ? 2 : 2.3)}`,
          pin: true,
          scrub: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      timeline
        .fromTo(gesture, { y: () => window.innerHeight }, {
          y: () => -imageHeight(mobile ? 0.5 : 0.3, 2560 / 1708),
          duration: 0.74,
        }, 0)
        .fromTo(coffee, { y: () => window.innerHeight }, {
          y: () => -imageHeight(mobile ? 0.5 : 0.25, 1846 / 1231),
          duration: 0.59,
        }, 0.41)
        .to(arrow, { opacity: 0, duration: 0.08 }, 0)
        .to(passages[0], { opacity: 0, duration: 0.08 }, 0.35)
        .to(passages[1], { opacity: 1, duration: 0.08 }, 0.35)
        .to(passages[1], { opacity: 0, duration: 0.09 }, 0.69)
        .to(passages[2], { opacity: 1, duration: 0.09 }, 0.69)

      let active = true
      // A font can finish after the preloader's asset deadline.
      void document.fonts.ready.then(() => {
        if (active) ScrollTrigger.refresh()
      })

      return () => {
        active = false
        delete stage.dataset.animated
        // Opacity belongs to the crossfade; the static layout uses the CSS default.
        passages.forEach((passage) => passage.style.removeProperty('opacity'))
      }
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })
}
