import { useRef } from 'react'
import { Link } from 'react-router'
import { projects } from '@/modules/projects/data/projects'
import { gsap, useGSAP, ScrollSmoother, ScrollTrigger } from '@/shared/animation/gsap'
import { useAnimationReady } from '@/shared/animation/readiness'
import { usePixelHover } from '@/shared/animation/usePixelHover'
import styles from './FeaturedProjects.module.scss'

const featured = projects.filter((project) => project.featured)

export default function FeaturedProjects() {
  const root = useRef<HTMLElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const selected = useRef<HTMLSpanElement>(null)
  const works = useRef<HTMLSpanElement>(null)
  const ready = useAnimationReady()
  usePixelHover(root)

  useGSAP(() => {
    if (!ready || !stage.current || !track.current || featured.length === 0) return

    const viewport = stage.current
    const gallery = track.current
    const media = gsap.matchMedia()

    media.add({
      desktop: '(min-width: 768px)',
      mobile: '(max-width: 767px)',
      motion: '(prefers-reduced-motion: no-preference)',
    }, (context) => {
      if (!context.conditions?.motion) return

      viewport.dataset.animated = 'true'

      const entranceDuration = 0.8
      const galleryStart = 0.65
      const galleryDuration = 3.8
      const startX = () => viewport.clientWidth * 1.35
      const endX = () => {
        const lastProject = gallery.lastElementChild as HTMLElement
        return (viewport.clientWidth - lastProject.offsetWidth) / 2 - lastProject.offsetLeft
      }

      const titleEntrance = gsap.timeline({
        scrollTrigger: {
          trigger: viewport,
          start: 'top bottom',
          end: 'top 20%',
          scrub: 0.25,
          invalidateOnRefresh: true,
        },
      })

      titleEntrance
        .fromTo(selected.current, { x: () => -viewport.clientWidth }, {
          x: 0,
          duration: entranceDuration,
          ease: 'power1.out',
        }, 0)
        .fromTo(works.current, { x: () => viewport.clientWidth }, {
          x: 0,
          duration: entranceDuration,
          ease: 'power1.out',
        }, 0)

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: viewport,
          start: 'top top',
          end: () => `+=${window.innerHeight * (context.conditions?.mobile ? 3.3 : 3.7)}`,
          pin: true,
          scrub: 0.25,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      timeline.fromTo(gallery, { x: startX }, {
          x: endX,
          duration: galleryDuration,
          ease: 'power1.out',
        }, galleryStart)

      // Bring off-screen projects into view when visitors tab through the gallery.
      const handleFocus = (event: FocusEvent) => {
        const link = event.target
        if (!(link instanceof HTMLAnchorElement) || !link.matches(':focus-visible')) return

        const card = link.closest<HTMLElement>('[data-featured-project]')
        const trigger = timeline.scrollTrigger
        if (!card || !trigger) return

        const bounds = card.getBoundingClientRect()
        if (bounds.left >= 0 && bounds.right <= viewport.clientWidth &&
          bounds.top >= 0 && bounds.bottom <= window.innerHeight) return

        const centeredX = viewport.clientWidth / 2 - card.offsetLeft - card.clientWidth / 2
        const horizontalProgress = gsap.utils.clamp(0, 1, (startX() - centeredX) / (startX() - endX()))
        const galleryProgress = 1 - Math.sqrt(1 - horizontalProgress)
        const progress = (galleryStart + galleryProgress * galleryDuration) / timeline.duration()
        const scroll = trigger.start + progress * (trigger.end - trigger.start)
        const smoother = ScrollSmoother.get()

        if (smoother) smoother.scrollTop(scroll)
        else window.scrollTo({ top: scroll, behavior: 'instant' })

        trigger.update()
        timeline.progress(progress)
      }

      gallery.addEventListener('focusin', handleFocus)

      return () => {
        gallery.removeEventListener('focusin', handleFocus)
        delete viewport.dataset.animated
      }
    })

    return () => media.revert()
  }, { scope: root, dependencies: [ready], revertOnUpdate: true })

  return (
    <section ref={root} className={styles.section} aria-labelledby="featured-projects-title">
      <div ref={stage} className={styles.stage} data-featured-stage>
        <h2 id="featured-projects-title" className={styles.heading} data-featured-title>
          <span ref={selected} className={styles.selected}><span className={styles.serif}>S</span>el<span className={styles.serif}>e</span>ct<span className={styles.serif}>ed</span></span>{' '}
          <span ref={works} className={styles.works}><span className={styles.serif}>w</span>or<span className={styles.serif}>k</span>s</span>
        </h2>
        <div ref={track} className={styles.track} data-featured-track>
          {featured.map((project, index) => (
            <article key={project.slug} className={styles.project} data-featured-project>
              <Link
                data-cursor="project"
                className={styles.projectLink}
                to={`/projects/${project.slug}`}
                aria-label={`${project.title} — ${project.category}, ${project.year}`}
              >
                <div className={styles.imageFrame}>
                  <img
                    data-pixel-hover
                    className={styles.image}
                    src={project.cover.src}
                    alt={project.cover.alt}
                    style={{ objectPosition: project.cover.position }}
                    loading="eager"
                    decoding="async"
                    width={project.cover.format === 'landscape' ? 1400 : 1100}
                    height={project.cover.format === 'portrait' ? 1460 : 1050}
                    onLoad={() => ScrollTrigger.refresh()}
                    data-featured-image
                  />
                  <span className={styles.viewProject} aria-hidden="true">View project ↗</span>
                </div>
                <h3 className={styles.projectTitle}>
                  <span>{String(index + 1).padStart(2, '0')}.</span> {project.title}
                </h3>
              </Link>
            </article>
          ))}
        </div>
      </div>
      <Link className={styles.archive} to="/projects">
        All projects <span aria-hidden="true">↗</span>
      </Link>
    </section>
  )
}
