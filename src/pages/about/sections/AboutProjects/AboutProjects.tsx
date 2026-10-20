import { Link } from 'react-router'
import { projects } from '@/modules/projects/data/projects'
import Container from '@/shared/ui/Container/Container'
import { aboutContent } from '../../content'
import styles from './AboutProjects.module.scss'

export default function AboutProjects() {
  return (
    <section
      className={styles.section}
      aria-labelledby="about-projects-title"
      data-about-section="projects"
    >
      <Container>
        <div className={styles.content}>
          <h2 id="about-projects-title" className={styles.title}>
            {aboutContent.projects.label}
          </h2>
          <p className={styles.description}>{aboutContent.projects.description}</p>
          <ul className={styles.projects}>
            {projects.filter((project) => project.featured).map((project) => (
              <li key={project.slug} className={styles.project}>
                <Link
                  className={styles.link}
                  to={`/projects/${project.slug}`}
                  aria-label={`View ${project.title} project`}
                  data-cursor="project"
                  data-about-project
                >
                  {project.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}
