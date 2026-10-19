import { useRef } from 'react'
import Container from '@/shared/ui/Container/Container'
import { useStudioStatementMotion } from './useStudioStatementMotion'
import handsImage from './assets/hands.jpg'
import styles from './StudioStatement.module.scss'

export default function StudioStatement() {
  const root = useRef<HTMLElement>(null)
  useStudioStatementMotion(root)

  return (
    <section
      ref={root}
      className={styles.section}
      aria-labelledby="studio-statement-title"
      data-studio-statement
    >
      <Container>
        <div className={styles.content}>
          <div className={styles.introduction}>
            <h2 id="studio-statement-title" className={styles.headline}>
              <span className={styles.line} data-statement-line>
                <span className={styles.serif}>We</span> creat<span className={styles.serif}>e,</span>
              </span>{' '}
              <span className={styles.line} data-statement-line>
                desi<span className={styles.serif}>gn</span> an<span className={styles.serif}>d</span>
              </span>{' '}
              <span className={styles.line} data-statement-line>
                <span className={styles.serif}>conne</span>ct
              </span>{' '}
              <span className={styles.line} data-statement-line>
                br<span className={styles.serif}>ands to</span>
              </span>{' '}
              <span className={styles.line} data-statement-line>
                pe<span className={styles.serif}>opl</span>e
              </span>
            </h2>
            <p className={styles.note} data-statement-note>
              Clear ideas. Thoughtful design. Work that feels as good as it looks,
              and gives people a reason to connect.
            </p>
          </div>
          <div className={styles.details}>
            <p className={styles.description} data-statement-detail>
              Every project starts with a conversation. Together, we shape the
              idea, explore the details and bring it to life — from the first
              sketch to the final experience.
            </p>
            <figure className={styles.figure} data-statement-detail>
              <img
                className={styles.image}
                src={handsImage}
                alt="Two outstretched hands gesturing against a light background"
                width="1920"
                height="1920"
                loading="lazy"
                decoding="async"
                data-statement-image
              />
            </figure>
          </div>
        </div>
      </Container>
    </section>
  )
}
