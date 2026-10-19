import AboutHero from './sections/AboutHero/AboutHero'
import AboutServices from './sections/AboutServices/AboutServices'
import AboutPhilosophy from './sections/AboutPhilosophy/AboutPhilosophy'
import AboutProjects from './sections/AboutProjects/AboutProjects'
import styles from './AboutPage.module.scss'

export default function AboutPage() {
  return (
    <div className={styles.page} data-about-page>
      <AboutHero />
      <AboutServices />
      <AboutPhilosophy />
      <AboutProjects />
    </div>
  )
}
