import { useRef } from 'react'
import { ScrollTrigger } from '@/shared/animation/gsap'
import AnimatedArrow from '@/shared/ui/AnimatedArrow/AnimatedArrow'
import { aboutContent } from '../../content'
import gesture from '../../assets/gesture.jpg'
import coffeeStudy from '../../assets/coffee-study.jpg'
import { useAboutHeroMotion } from './useAboutHeroMotion'
import styles from './AboutHero.module.scss'

export default function AboutHero() {
  const root = useRef<HTMLElement>(null)
  useAboutHeroMotion(root)

  return (
    <section ref={root} className={styles.hero} aria-labelledby="about-title" data-about-section="hero" data-about-hero>
      <div className={styles.stage} data-about-hero-stage>
        <div className={styles.content}>
          <h1 id="about-title" className={styles.title}>
            Ab<span className={styles.serif}>ou</span>t <span className={styles.serif}>us</span>
          </h1>
          <div className={styles.passages}>
            {aboutContent.hero.paragraphs.map((paragraph) => (
              <p key={paragraph} data-about-passage>{paragraph}</p>
            ))}
          </div>
          <span className={styles.arrow} aria-hidden="true" data-about-hero-arrow>
            <AnimatedArrow variant="light" />
          </span>
        </div>
        <div className={styles.images}>
          <div className={`${styles.imageFrame} ${styles.gesture}`} data-about-hero-image="gesture">
            <img
              src={gesture}
              alt="Sunlight and shadows falling across an outstretched hand"
              width={1708}
              height={2560}
              decoding="async"
              onLoad={() => ScrollTrigger.refresh()}
              data-about-image
            />
          </div>
          <div className={`${styles.imageFrame} ${styles.coffee}`} data-about-hero-image="coffee">
            <img
              src={coffeeStudy}
              alt="An editorial still life with a cup of coffee"
              width={1231}
              height={1846}
              decoding="async"
              onLoad={() => ScrollTrigger.refresh()}
              data-about-image
            />
          </div>
        </div>
      </div>
    </section>
  )
}
