import type { RefObject } from 'react'
import { gsap, ScrollTrigger, useGSAP } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

type Refs = {
  hero: RefObject<HTMLElement | null>
  stage: RefObject<HTMLDivElement | null>
}

/** Layout coordinates stay stable while ScrollSmoother and pinning transform ancestors. */
function layoutPosition(element: HTMLElement, ancestor: HTMLElement) {
  let x = 0
  let y = 0
  let node: HTMLElement | null = element

  while (node && node !== ancestor) {
    x += node.offsetLeft
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }

  return { x, y }
}

export function useHeroSpecialtiesAnimation({ hero, stage }: Refs) {
  const ready = useAnimationReady()

  useGSAP(() => {
    const viewport = stage.current
    if (!ready || !hero.current || !viewport) return

    const words = Array.from(viewport.querySelectorAll<HTMLElement>('[data-specialty-word]'))
    const sources = Array.from(viewport.querySelectorAll<HTMLElement>('[data-specialty-source]'))
    const label = viewport.querySelector<HTMLElement>('[data-specialties-label]')
    const statement = words[0]?.parentElement
    if (words.length !== sources.length || !statement || !label) return

    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      viewport.dataset.animated = 'true'

      const origin = (index: number) => {
        const from = layoutPosition(sources[index], viewport)
        // CSS translate centers the measurement row without changing its layout offsets.
        const sourceRow = sources[index].parentElement!
        from.x -= sourceRow.offsetWidth / 2
        const to = layoutPosition(words[index], viewport)
        return {
          x: from.x - to.x,
          y: from.y - to.y,
          scale: sources[index].offsetWidth / words[index].offsetWidth,
        }
      }

      const expansion = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero.current,
          start: 'top top',
          end: () => `+=${window.innerHeight * 0.6}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      words.forEach((word, index) => {
        expansion.fromTo(word, {
          x: () => origin(index).x,
          y: () => origin(index).y,
          scale: () => origin(index).scale,
        }, { x: 0, y: 0, scale: 1, duration: 1 }, 0)
      })
      expansion.fromTo(label, { opacity: 1 }, { opacity: 0, duration: 1 / 3 }, 0)

      const pin = ScrollTrigger.create({
        trigger: viewport,
        start: 'top 14%',
        end: () => `+=${window.innerHeight * 0.6}`,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      })

      gsap.to(statement, {
        opacity: 0,
        ease: 'power1.in',
        scrollTrigger: {
          trigger: viewport,
          // Use the resolved pin range: refresh temporarily removes its layout spacing.
          start: () => pin.end - window.innerHeight * 0.1,
          end: () => pin.end + window.innerHeight * 0.5,
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      let active = true
      // The preloader can time out before a slow font finishes loading.
      void document.fonts.ready.then(() => {
        if (active) ScrollTrigger.refresh()
      })

      return () => {
        active = false
        delete viewport.dataset.animated
      }
    })

    return () => media.revert()
  }, { scope: stage, dependencies: [ready], revertOnUpdate: true })
}
