import { Link } from 'react-router'
import type { Project } from '@/modules/projects/model/types'
import styles from './ProjectCard.module.scss'
import { useRef } from 'react'
import { gsap, useGSAP, ScrollTrigger } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'

export default function ProjectCard({ project }: { project: Project }) {
  const root = useRef<HTMLElement>(null)
  const image = useRef<HTMLDivElement>(null)
  const ready = useAnimationReady()

  useGSAP(() => {
    if (!ready || !root.current || !image.current) return

    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(image.current, { yPercent: -22.5 }, {
        yPercent: 22.5,
        ease: 'none',
        scrollTrigger: {
          trigger: root.current,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      })
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })

  return (
    <article ref={root} className={`${styles.card} ${styles[project.cover.format]}`}>
      <Link
        className={styles.link}
        to={`/projects/${project.slug}`}
        aria-label={`${project.title} — ${project.category}, ${project.year}`}
      >
        <div className={styles.media}>
          <div ref={image} className={styles.imageMotion}>
            <img
              className={styles.image}
              src={project.cover.src}
              alt={project.cover.alt}
              style={{ objectPosition: project.cover.position }}
              loading="lazy"
              decoding="async"
              width={project.cover.format === 'landscape' ? 1400 : 1100}
              height={project.cover.format === 'portrait' ? 1460 : 1050}
              onLoad={() => ScrollTrigger.refresh()}
            />
          </div>
        </div>
        <div className={styles.label}>
          <span className={styles.mark} aria-hidden="true" />
          <h3 className={styles.title}>{project.title}</h3>
        </div>
      </Link>
    </article>
  )
}
