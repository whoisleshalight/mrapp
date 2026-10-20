import { useLayoutEffect, useState } from 'react'
import { ScrollSmoother, ScrollTrigger } from '@/shared/animation/gsap'

/** Initialize sections, settle their scroll position, then allow the loader to reveal them. */
export function usePreparedLayout(assetsReady: boolean) {
  const [prepared, setPrepared] = useState(false)

  useLayoutEffect(() => {
    if (!assetsReady) return
    let frame = requestAnimationFrame(() => {
      const position = window.scrollY
      ScrollTrigger.refresh()
      ScrollSmoother.get()?.scrollTop(position)
      ScrollTrigger.update()
      // Numeric scrub durations must not ease from their initial state after the reveal.
      ScrollTrigger.getAll().forEach((trigger) => {
        const scrub = trigger.getTween()
        if (scrub && typeof scrub.progress === 'function') scrub.progress(1)
      })
      frame = requestAnimationFrame(() => setPrepared(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [assetsReady])

  return prepared
}
