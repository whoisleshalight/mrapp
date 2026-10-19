import type { RefObject } from 'react'
import { gsap, useGSAP } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

export function useAboutServicesMotion(root: RefObject<HTMLElement | null>) {
  const ready = useAnimationReady()

  useGSAP(() => {
    const section = root.current
    const stage = section?.querySelector<HTMLElement>('[data-about-services-stage]')
    if (!ready || !section || !stage) return

    const media = gsap.matchMedia()

    media.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      stage.dataset.animated = 'true'

      const articles = gsap.utils.toArray<HTMLElement>('[data-about-service]', stage)
      const titles = gsap.utils.toArray<HTMLElement>('[data-service-title]', stage)
      const images = gsap.utils.toArray<HTMLElement>('[data-service-media]', stage)
      const descriptions = gsap.utils.toArray<HTMLElement>('[data-service-description]', stage)
      const intro = stage.querySelector<HTMLElement>('[data-service-intro]')

      gsap.set([...images, ...descriptions], { opacity: 0 })

      const timeline = gsap.timeline({
        defaults: { ease: 'power1.out' },
        scrollTrigger: {
          trigger: stage,
          start: 'top top',
          end: () => `+=${window.innerHeight * 2.8}`,
          pin: true,
          scrub: 0.2,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      timeline
        .to(intro, { opacity: 0, duration: 0.35 }, 0)
        .fromTo(titles, {
          x: (index) => window.innerWidth * (index === 1 ? -1.3 : 1.1),
        }, { x: 0, duration: 0.75 }, 0.2)
        .to(titles.slice(1), { opacity: 0, duration: 0.3 }, 1.15)
        .to([images[0], descriptions[0]], { opacity: 1, duration: 0.35 }, 1.15)

      articles.slice(1).forEach((_, index) => {
        const at = 2.2 + index * 1.1
        timeline
          .to([titles[index], images[index], descriptions[index]], { opacity: 0, duration: 0.3 }, at)
          .to(titles[index + 1], { opacity: 1, duration: index === 1 ? 0.8 : 0.35 }, at)
          .to([images[index + 1], descriptions[index + 1]], { opacity: 1, duration: 0.35 }, at)
      })

      return () => { delete stage.dataset.animated }
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })
}
