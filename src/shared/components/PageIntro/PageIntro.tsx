import styles from './PageIntro.module.scss'

type Props = { title: string; description?: string; eyebrow?: string }

export default function PageIntro({ title, description, eyebrow }: Props) {
  return (
    <header className={styles.intro}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
    </header>
  )
}
