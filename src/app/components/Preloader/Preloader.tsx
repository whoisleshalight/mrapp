import { useEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '../../../shared/animation/gsap'
import { site } from '../../../shared/config/site'
import { motion, prefersReducedMotion } from '../../config/motion'
import styles from './Preloader.module.scss'

type Props = { ready: boolean; onComplete: (ready: boolean) => void }

export default function Preloader({ ready, onComplete }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [assetsReady, setAssetsReady] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    let active = true
    let onLoad: () => void = () => {}
    let timeout: ReturnType<typeof setTimeout>
    const loaded = new Promise<void>((resolve) => {
      onLoad = resolve
      if (document.readyState === 'complete') resolve()
      else window.addEventListener('load', onLoad, { once: true })
    })
    const fonts = document.fonts?.ready ?? Promise.resolve()
    const deadline = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, motion.assetWaitTimeout)
    })
    // A stalled font or asset must not leave the site behind the loader forever.
    void Promise.race([Promise.allSettled([loaded, fonts]), deadline]).then(() => {
      clearTimeout(timeout)
      window.removeEventListener('load', onLoad)
      if (active) setAssetsReady(true)
    })
    return () => {
      active = false
      clearTimeout(timeout)
      window.removeEventListener('load', onLoad)
    }
  }, [])

  useEffect(() => {
    if (finished) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [finished])

  useEffect(() => {
    if (!ready || !assetsReady || finished || !root.current) return
    const animation = gsap.to(root.current, {
      yPercent: -100,
      duration: prefersReducedMotion() ? 0 : motion.preloaderDuration,
      ease: motion.ease,
      onComplete: () => {
        setFinished(true)
        onComplete(true)
        ScrollTrigger.refresh()
      },
    })
    return () => { animation.kill() }
  }, [ready, assetsReady, finished, onComplete])

  if (finished) return null
  return (
    <div ref={root} className={styles.preloader} role="status" aria-live="polite" aria-label="Завантаження сайту">
      <span className={styles.brand} aria-hidden="true">{site.name}</span>
      <span>Завантаження…</span>
    </div>
  )
}
