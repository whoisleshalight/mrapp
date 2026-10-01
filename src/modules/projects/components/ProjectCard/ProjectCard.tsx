import { Link } from 'react-router'
import type { Project } from '../../types'
import styles from './ProjectCard.module.scss'

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <article className={styles.card}>
      <p className={styles.meta}>{project.category} · {project.year}</p>
      <h3><Link to={`/projects/${project.slug}`}>{project.title}</Link></h3>
      <p>{project.summary}</p>
    </article>
  )
}
