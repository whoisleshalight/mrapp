import { Link } from 'react-router'
import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'

export default function NotFoundPage() {
  return <Container><PageIntro title="404" description="Сторінку не знайдено." /><Link to="/">На головну</Link></Container>
}
