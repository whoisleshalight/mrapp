import Container from '../../shared/components/Container/Container'
import ProjectGrid from '../../modules/projects/components/ProjectGrid/ProjectGrid'
import { projects } from '../../modules/projects/data/projects'
import styles from './ProjectsPage.module.scss'

export default function ProjectsPage() {
  return (
    <Container>
      <section className={styles.section} aria-labelledby="projects-title">
        <header className={styles.heading}>
          <p>Selected work</p>
          <h1 id="projects-title">Projects</h1>
        </header>
        <ProjectGrid items={projects} />
      </section>
    </Container>
  )
}
