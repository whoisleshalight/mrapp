import { useEffect, type RefObject } from 'react'
import { usePageInteractive } from '@/shared/animation/readiness'
import { useReducedMotion } from '@/shared/animation/useReducedMotion'
import { mountPixelImages } from './mountPixelImages'

/** Share one bounded renderer pool across the grid; release it when navigation starts. */
export function usePixelImages(ref: RefObject<HTMLElement | null>) {
  const interactive = usePageInteractive()
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!interactive || reduced || !ref.current) return
    return mountPixelImages(ref.current)
  }, [ref, interactive, reduced])
}
