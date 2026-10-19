import { useRef, type RefObject } from 'react'
import { useHeroSpecialtiesAnimation } from './useHeroSpecialtiesAnimation'
import styles from './HeroSpecialties.module.scss'

type Props = { hero: RefObject<HTMLElement | null> }

/** A single readable statement moves from the small caption into three display rows. */
export default function HeroSpecialties({ hero }: Props) {
  const stage = useRef<HTMLDivElement>(null)
  useHeroSpecialtiesAnimation({ hero, stage })

  return (
    <div className={styles.specialties} data-specialties>
      <div ref={stage} className={styles.stage} data-specialties-stage>
        <p className={styles.label} data-specialties-label>Specialized in</p>
        <p className={styles.statement}>
          <span className={styles.word} data-specialty-word="branding">Branding,</span>{' '}
          <span className={styles.word} data-specialty-word="editorial">Editorial design</span>{' '}
          <span className={styles.word} data-specialty-word="packaging">
            <span className={styles.and}>and</span> Packaging
          </span>
        </p>
        {/* Layout targets only: the visible statement above is the accessible copy. */}
        <div className={styles.source} aria-hidden="true" data-specialties-source>
          <span data-specialty-source>Branding,</span>{' '}
          <span data-specialty-source>Editorial design</span>{' '}
          <span data-specialty-source><span className={styles.and}>and</span> Packaging</span>
        </div>
      </div>
    </div>
  )
}
