import { Link, useParams } from 'react-router'
import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import { getPostBySlug } from '../../modules/blog/data/posts'
import NotFoundPage from '../not-found/NotFoundPage'
import styles from './PostPage.module.scss'

export default function PostPage() {
  const { slug } = useParams()
  const post = getPostBySlug(slug)
  if (!post) return <NotFoundPage />

  return (
    <Container>
      <article>
        <PageIntro title={post.title} description={post.excerpt} />
        <time dateTime={post.publishedAt}>{post.publishedAt}</time>
        <div className={styles.content}>{post.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </article>
      <Link to="/blog">Усі дописи</Link>
    </Container>
  )
}
