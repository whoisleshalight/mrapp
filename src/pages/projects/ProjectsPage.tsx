import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import ProjectGrid from '../../modules/projects/components/ProjectGrid/ProjectGrid'
import { projects } from '../../modules/projects/data/projects'

export default function ProjectsPage() {
  return <Container><PageIntro title="Проєкти" description="Архів робіт." /><ProjectGrid items={projects} /></Container>
}
