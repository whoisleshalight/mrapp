import type { Post } from '../types'

// Demo content. Keep dates in ISO format.
export const posts: Post[] = [
  {
    slug: 'first-post',
    title: 'Перший допис',
    excerpt: 'Тут буде короткий вступ до статті.',
    publishedAt: '2026-10-01',
    body: ['Тут буде контент статті.'],
  },
]

export function getPostBySlug(slug: string | undefined) {
  return posts.find((post) => post.slug === slug)
}
