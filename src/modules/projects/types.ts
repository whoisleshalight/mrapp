export type Project = {
  slug: string
  title: string
  category: string
  year: number
  summary: string
  body: string[]
  featured: boolean
  cover: {
    src: string
    alt: string
    format: 'portrait' | 'landscape' | 'square'
    position?: string
  }
}
