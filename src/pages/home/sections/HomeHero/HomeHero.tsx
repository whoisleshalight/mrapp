import { useRef } from 'react'
import { Link } from 'react-router'
import { useReveal } from '../../../../shared/animation/useReveal'
import styles from './HomeHero.module.scss'

export default function HomeHero() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <section ref={root} className={styles.hero} aria-labelledby="home-title">
      <p data-reveal>Портфоліо</p>
      <h1 id="home-title" data-reveal>Дизайн, розробка та рух.</h1>
      <p data-reveal>Тут буде твій вступ і позиціювання.</p>
      <Link data-reveal to="/projects">Переглянути проєкти</Link>
    </section>
  )
}
