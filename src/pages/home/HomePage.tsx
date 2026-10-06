import Container from '../../shared/components/Container/Container'
import HomeHero from './sections/HomeHero/HomeHero'
import styles from './HomePage.module.scss'

export default function HomePage() {
  return <Container><div className={styles.sections}><HomeHero /></div></Container>
}
