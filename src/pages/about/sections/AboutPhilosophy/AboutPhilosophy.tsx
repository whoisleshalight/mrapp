import { useRef } from 'react'
import Container from '@/shared/ui/Container/Container'
import coffeeImage from '../../assets/coffee-detail.jpg'
import { useAboutPhilosophyMotion } from './useAboutPhilosophyMotion'
import styles from './AboutPhilosophy.module.scss'

export default function AboutPhilosophy() {
  const root = useRef<HTMLElement>(null)
  useAboutPhilosophyMotion(root)

  return (
    <section
      ref={root}
      className={styles.section}
      aria-labelledby="about-philosophy-title"
      data-about-section="philosophy"
      data-about-philosophy
    >
      <Container>
        <div className={styles.content}>
          <h2 id="about-philosophy-title" className={styles.headline}>
            <span className={styles.line}>
              W<span className={styles.serif}>e</span> de<span className={styles.serif}>s</span>i<span className={styles.serif}>gn</span>
            </span>{' '}
            <span className={styles.line} data-about-reveal>
              <span className={styles.serif}>w</span>i<span className={styles.serif}>t</span>h <span className={styles.serif}>l</span>o<span className={styles.serif}>v</span>e
            </span>{' '}
            <span className={styles.line} data-about-reveal>
              <span className={styles.serif}>f</span>or <span className={styles.serif}>ev</span>e<span className={styles.serif}>r</span>y
            </span>{' '}
            <span className={styles.line} data-about-reveal>
              <span className={styles.serif}>d</span>e<span className={styles.serif}>t</span>ai<span className={styles.serif}>l</span>
            </span>
          </h2>
          <figure className={styles.figure} data-about-philosophy-image>
            <img
              className={styles.image}
              src={coffeeImage}
              alt="A white coffee cup resting on a stack of design magazines"
              width="1920"
              height="1920"
              loading="lazy"
              decoding="async"
              data-about-image
            />
          </figure>
        </div>
      </Container>
    </section>
  )
}
