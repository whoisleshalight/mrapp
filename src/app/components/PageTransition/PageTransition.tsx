import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker, useLocation } from 'react-router'
import { gsap, ScrollTrigger } from '../../../shared/animation/gsap'
import { motion, prefersReducedMotion } from '../../config/motion'
import styles from './PageTransition.module.scss'
import { TransitionReadinessContext } from '../../../shared/animation/readiness'

/** Covers the old route before navigation and reveals the new route after commit. */
export default function PageTransition() {
  const overlay = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const setReady = useContext(TransitionReadinessContext)
  const { key } = useLocation()
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search,
  )
  const proceed = blocker.proceed

  useEffect(() => {
    if (blocker.state !== 'blocked' || !proceed || !overlay.current) return
    pending.current = true
    setReady(false)
    const animation = gsap.to(overlay.current, {
      scaleY: 1,
      transformOrigin: 'bottom',
      duration: prefersReducedMotion() ? 0 : motion.transitionDuration,
      ease: motion.ease,
      overwrite: true,
      onComplete: proceed,
    })
    // Preserve the covered state while React Router loads a lazy route.
    return () => { animation.kill() }
  }, [blocker.state, proceed, setReady])

  useLayoutEffect(() => {
    if (!pending.current || !overlay.current) return
    pending.current = false
    const animation = gsap.to(overlay.current, {
      scaleY: 0,
      transformOrigin: 'top',
      duration: prefersReducedMotion() ? 0 : motion.transitionDuration,
      ease: motion.ease,
      overwrite: true,
      onComplete: () => {
        setReady(true)
        ScrollTrigger.refresh()
      },
    })
    return () => { animation.kill() }
  }, [key, setReady])

  // Route errors can unmount the layout while a lazy route is loading.
  useEffect(() => () => { setReady(true) }, [setReady])

  return <div ref={overlay} data-transition-overlay className={styles.overlay} aria-hidden="true" style={{ pointerEvents: blocker.state === 'unblocked' ? 'none' : 'auto' }} />
}
