import { Link, useParams } from 'react-router'
import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import { getProjectBySlug } from '../../modules/projects/data/projects'
import NotFoundPage from '../not-found/NotFoundPage'
import styles from './ProjectPage.module.scss'

export default function ProjectPage() {
  const { slug } = useParams()
  const project = getProjectBySlug(slug)
  if (!project) return <NotFoundPage />

  return (
    <Container>
      <article>
        <PageIntro title={project.title} eyebrow={`${project.category} · ${project.year}`} description={project.summary} />
        <div className={styles.content}>{project.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </article>
      <Link to="/projects">Усі проєкти</Link>
    </Container>
  )
}
