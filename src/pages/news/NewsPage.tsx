import Container from '../../shared/components/Container/Container'
import PageIntro from '../../shared/components/PageIntro/PageIntro'
import PostCard from '../../modules/news/components/PostCard/PostCard'
import { posts } from '../../modules/news/data/posts'

export default function NewsPage() {
  return (
    <Container>
      <PageIntro title="Новини" description="Нотатки, досвід та ідеї." />
      {[...posts].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).map((post) => <PostCard key={post.slug} post={post} />)}
    </Container>
  )
}
