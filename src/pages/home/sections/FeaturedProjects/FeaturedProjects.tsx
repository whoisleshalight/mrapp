import { Link } from 'react-router'
import ProjectGrid from '../../../../modules/projects/components/ProjectGrid/ProjectGrid'
import { projects } from '../../../../modules/projects/data/projects'
import styles from './FeaturedProjects.module.scss'

export default function FeaturedProjects() {
  const featured = projects.filter((project) => project.featured)

  return (
    <section className={styles.section} aria-labelledby="featured-projects-title">
      <header className={styles.heading}>
        <h2 id="featured-projects-title">Selected work</h2>
        <span className={styles.count}>({String(featured.length).padStart(2, '0')})</span>
      </header>
      <ProjectGrid items={featured} />
      <Link className={styles.archive} to="/projects">
        All projects <span aria-hidden="true">↗</span>
      </Link>
    </section>
  )
}
