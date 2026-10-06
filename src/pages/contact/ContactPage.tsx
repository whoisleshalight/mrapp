import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { site } from '../../shared/config/site'
import video from '../../assets/media/01.mp4'
import styles from './ContactPage.module.scss'

const motionQuery = '(prefers-reduced-motion: reduce)'
const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia(motionQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const getReducedMotion = () => window.matchMedia(motionQuery).matches

export default function ContactPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const reducedMotion = useSyncExternalStore(subscribeMotion, getReducedMotion, () => true)
  const [paused, setPaused] = useState(true)

  useEffect(() => {
    if (reducedMotion) videoRef.current?.pause()
  }, [reducedMotion])

  const toggleVideo = () => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) void element.play().catch(() => {})
    else element.pause()
  }

  return (
    <section className={styles.page} aria-labelledby="contact-title">
      <video
        ref={videoRef}
        className={styles.video}
        src={video}
        autoPlay={!reducedMotion}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        data-contact-video
        onPlay={() => setPaused(false)}
        onPause={() => setPaused(true)}
      />
      <div className={styles.shade} aria-hidden="true" />
      <div className={styles.content}>
        <p className={styles.eyebrow}>Have a project in mind?</p>
        <h1 id="contact-title" className={styles.title}>
          Let’s make<br />
          <span>something great.</span>
        </h1>
        <a className={styles.email} href={`mailto:${site.email}`}>
          <span>{site.email}</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </a>
      </div>
      <div className={styles.bottom}>
        <p>Every great project starts with a conversation.</p>
        <button
          type="button"
          className={styles.playback}
          onClick={toggleVideo}
          aria-label={paused ? 'Play background video' : 'Pause background video'}
        >
          <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
          {paused ? 'Play film' : 'Pause film'}
        </button>
      </div>
    </section>
  )
}
