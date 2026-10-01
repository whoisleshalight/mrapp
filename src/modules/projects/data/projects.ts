import type { Project } from '../types'

// Demo content. Replace with real projects or an API adapter later.
export const projects: Project[] = [
  {
    slug: 'sample-project',
    title: 'Приклад проєкту',
    category: 'Вебсайт',
    year: 2026,
    summary: 'Тут буде короткий опис проєкту.',
    body: ['Тут буде задача, процес роботи й результат проєкту.'],
    featured: true,
  },
]

export function getProjectBySlug(slug: string | undefined) {
  return projects.find((project) => project.slug === slug)
}
