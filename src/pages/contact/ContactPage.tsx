import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import { site } from '../../shared/config/site'

export default function ContactPage() {
  return (
    <Container>
      <PageIntro title="Контакти" description="Обговорімо твій наступний проєкт." />
      <a href={`mailto:${site.email}`}>{site.email}</a>
    </Container>
  )
}
