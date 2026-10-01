import Container from '../Container/Container'
import { site } from '../../config/site'
import styles from './SiteFooter.module.scss'

export default function SiteFooter() {
  return <footer className={styles.footer}><Container>© {new Date().getFullYear()} {site.name}</Container></footer>
}
