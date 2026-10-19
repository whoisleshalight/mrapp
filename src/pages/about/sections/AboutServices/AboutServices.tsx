import { useRef } from 'react'
import Container from '@/shared/ui/Container/Container'
import { aboutContent } from '../../content'
import brandingImage from '../../assets/branding.jpg'
import editorialImage from '../../assets/editorial.jpg'
import packagingImage from '../../assets/packaging.jpg'
import { useAboutServicesMotion } from './useAboutServicesMotion'
import styles from './AboutServices.module.scss'

const media = [
  { src: brandingImage, alt: 'Wine bottle labels with expressive typography', width: 1920, height: 1280 },
  { src: editorialImage, alt: 'An open editorial book with photography and typographic page design', width: 1400, height: 932 },
  { src: packagingImage, alt: 'A collection of packaging with a coordinated visual identity', width: 1728, height: 1152 },
]

export default function AboutServices() {
  const root = useRef<HTMLElement>(null)
  useAboutServicesMotion(root)

  return (
    <section
      ref={root}
      className={styles.section}
      aria-labelledby="about-services-title"
      data-about-section="services"
      data-about-services
    >
      <div className={styles.stage} data-about-services-stage>
        <Container>
          <h2 id="about-services-title" className={styles.intro} data-service-intro>
            We do <span className={styles.serif}>projects</span> of
          </h2>
          <div className={styles.services}>
            {aboutContent.services.map((service, index) => (
              <article
                key={service.id}
                className={`${styles.service} ${styles[service.id]}`}
                aria-labelledby={`about-service-${service.id}`}
                data-about-service={service.id}
              >
                <h3
                  id={`about-service-${service.id}`}
                  className={styles.title}
                  aria-label={service.title}
                  data-service-title
                >
                  {index === 2 && <><span className={styles.and}>and</span>{' '}</>}
                  {service.title}{index === 0 && ','}
                  <sup className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, '0')}</sup>
                </h3>
                <div className={styles.imageFrame} data-service-media>
                  <img
                    className={styles.image}
                    src={media[index].src}
                    alt={media[index].alt}
                    width={media[index].width}
                    height={media[index].height}
                    loading="lazy"
                    decoding="async"
                    data-about-image
                  />
                </div>
                <p className={styles.description} data-service-description>{service.description}</p>
              </article>
            ))}
          </div>
        </Container>
      </div>
    </section>
  )
}
