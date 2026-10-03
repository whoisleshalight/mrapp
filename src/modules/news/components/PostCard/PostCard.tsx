import { Link } from 'react-router'
import type { Post } from '../../types'
import styles from './PostCard.module.scss'

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className={styles.card}>
      <time dateTime={post.publishedAt}>{post.publishedAt}</time>
      <h2><Link to={`/news/${post.slug}`}>{post.title}</Link></h2>
      <p>{post.excerpt}</p>
    </article>
  )
}
