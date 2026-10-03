import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker, useLocation } from 'react-router'
import { gsap, ScrollTrigger } from '../../../shared/animation/gsap'
import { motion, prefersReducedMotion } from '../../config/motion'
import styles from './PageTransition.module.scss'
import { TransitionReadinessContext } from '../../../shared/animation/readiness'

type PendingTransition = {
  native?: ViewTransition
  resolveCommit?: () => void
  animation?: gsap.core.Tween
  finish: () => void
}

/** Darkens the old page while the new page is revealed from bottom to top. */
export default function PageTransition() {
  const overlay = useRef<HTMLDivElement>(null)
  const pending = useRef<PendingTransition | null>(null)
  const setReady = useContext(TransitionReadinessContext)
  const { key } = useLocation()
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search,
  )
  const proceed = blocker.proceed

  useEffect(() => {
    if (blocker.state !== 'blocked' || !proceed || !overlay.current) return

    // A second Back/Forward or programmatic navigation can interrupt a transition.
    const previous = pending.current
    previous?.native?.skipTransition()
    previous?.resolveCommit?.()
    previous?.animation?.kill()
    document.documentElement.classList.remove(styles.nativeTransition)

    const reduced = prefersReducedMotion()
    const useNative = !reduced && typeof document.startViewTransition === 'function'
    const transition: PendingTransition = {
      finish: () => {
        if (pending.current !== transition) return
        pending.current = null
        document.documentElement.classList.remove(styles.nativeTransition)
        setReady(true, !useNative)
        ScrollTrigger.refresh()
      },
    }
    pending.current = transition

    if (useNative) {
      gsap.set(overlay.current, { scaleY: 0 })
      document.documentElement.classList.add(styles.nativeTransition)
      transition.native = document.startViewTransition(() => {
        // Capture the outgoing page before readiness changes revert its animations.
        if (pending.current !== transition) return
        return new Promise<void>((resolve) => {
          transition.resolveCommit = resolve
          setReady(false, false)
          proceed()
        })
      })
      // Skipped snapshots must still release inert and complete navigation.
      void transition.native.ready.catch(() => {})
      void transition.native.finished.then(transition.finish, transition.finish)
      return
    }

    // Keep the curtain as a fallback for browsers without the snapshot API.
    setReady(false)
    transition.animation = gsap.to(overlay.current, {
      scaleY: 1,
      transformOrigin: 'bottom',
      duration: reduced ? 0 : motion.transitionDuration / 2,
      ease: motion.ease,
      overwrite: true,
      onComplete: proceed,
    })
  }, [blocker.state, proceed, setReady])

  useLayoutEffect(() => {
    const transition = pending.current
    if (!transition || !overlay.current) return
    if (transition.native) {
      // Lazy route content and ScrollRestoration have committed before the new snapshot.
      transition.resolveCommit?.()
      transition.resolveCommit = undefined
      return
    }
    transition.animation = gsap.to(overlay.current, {
      scaleY: 0,
      transformOrigin: 'top',
      duration: prefersReducedMotion() ? 0 : motion.transitionDuration / 2,
      ease: motion.ease,
      overwrite: true,
      onComplete: transition.finish,
    })
  }, [key])

  // Route errors can unmount the layout while a lazy route is loading.
  useEffect(() => () => {
    const transition = pending.current
    pending.current = null
    transition?.native?.skipTransition()
    transition?.resolveCommit?.()
    transition?.animation?.kill()
    document.documentElement.classList.remove(styles.nativeTransition)
    setReady(true)
  }, [setReady])

  return <div ref={overlay} data-transition-overlay className={styles.overlay} aria-hidden="true" style={{ pointerEvents: blocker.state === 'unblocked' ? 'none' : 'auto' }} />
}
