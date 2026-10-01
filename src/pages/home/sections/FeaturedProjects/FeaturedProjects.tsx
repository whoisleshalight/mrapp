import { Link } from 'react-router'
import { projects } from '../../../../modules/projects/data/projects'
import ProjectGrid from '../../../../modules/projects/components/ProjectGrid/ProjectGrid'
import styles from './FeaturedProjects.module.scss'

export default function FeaturedProjects() {
  return (
    <section aria-labelledby="featured-title">
      <div className={styles.heading}><h2 id="featured-title">Вибрані проєкти</h2><Link to="/projects">Усі проєкти</Link></div>
      <ProjectGrid items={projects.filter((project) => project.featured)} />
    </section>
  )
}
