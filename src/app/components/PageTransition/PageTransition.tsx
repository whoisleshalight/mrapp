import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { useBlocker, useLocation } from 'react-router'
import { gsap, ScrollTrigger } from '../../../shared/animation/gsap'
import { motion, prefersReducedMotion } from '../../config/motion'
import styles from './PageTransition.module.scss'
import { TransitionReadinessContext } from '../../../shared/animation/readiness'
import { waitForContactFrame } from './contactMedia'

type PendingTransition = {
  native?: ViewTransition
  resolveCommit?: () => void
  animation?: gsap.core.Tween
  contact: boolean
  controller: AbortController
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
  const destination = blocker.state === 'blocked' ? blocker.location.pathname : undefined

  useEffect(() => {
    if (blocker.state !== 'blocked' || !proceed || !overlay.current) return

    // A second Back/Forward or programmatic navigation can interrupt a transition.
    const previous = pending.current
    previous?.native?.skipTransition()
    previous?.resolveCommit?.()
    previous?.animation?.kill()
    previous?.controller.abort()
    document.documentElement.classList.remove(styles.nativeTransition, styles.contactTransition)

    const reduced = prefersReducedMotion()
    const useNative = !reduced && typeof document.startViewTransition === 'function'
    const transition: PendingTransition = {
      contact: /^\/contacts?\/?$/i.test(destination ?? ''),
      controller: new AbortController(),
      finish: () => {
        if (pending.current !== transition) return
        pending.current = null
        transition.controller.abort()
        document.documentElement.classList.remove(styles.nativeTransition, styles.contactTransition)
        setReady(true)
        ScrollTrigger.refresh()
      },
    }
    pending.current = transition

    if (useNative) {
      gsap.set(overlay.current, { scaleY: 0 })
      document.documentElement.classList.add(styles.nativeTransition)
      if (transition.contact) document.documentElement.classList.add(styles.contactTransition)
      transition.native = document.startViewTransition(() => {
        // Capture the outgoing page before readiness changes.
        if (pending.current !== transition) return
        return new Promise<void>((resolve) => {
          transition.resolveCommit = resolve
          setReady(false)
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
  }, [blocker.state, destination, proceed, setReady])

  useLayoutEffect(() => {
    const transition = pending.current
    if (!transition || !overlay.current) return
    if (transition.native) {
      // Lazy route content and ScrollRestoration have committed before the new snapshot.
      const resolveCommit = transition.resolveCommit
      transition.resolveCommit = undefined
      if (transition.contact) {
        void waitForContactFrame(transition.controller.signal).then(() => resolveCommit?.())
      } else resolveCommit?.()
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
    transition?.controller.abort()
    document.documentElement.classList.remove(styles.nativeTransition, styles.contactTransition)
    setReady(true)
  }, [setReady])

  return <div ref={overlay} data-transition-overlay className={styles.overlay} aria-hidden="true" style={{ pointerEvents: blocker.state === 'unblocked' ? 'none' : 'auto' }} />
}
