import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import PostCard from '../../modules/blog/components/PostCard/PostCard'
import { posts } from '../../modules/blog/data/posts'

export default function BlogPage() {
  return (
    <Container>
      <PageIntro title="Блог" description="Нотатки, досвід та ідеї." />
      {[...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((post) => <PostCard key={post.slug} post={post} />)}
    </Container>
  )
}
