import type { Project } from '../types'

// Demo content. Replace with real projects or an API adapter later.
export const projects: Project[] = [
  {
    slug: 'sample-project',
    title: 'Muse',
    category: 'Вебсайт',
    year: 2026,
    summary: 'Тут буде короткий опис проєкту.',
    body: ['Тут буде задача, процес роботи й результат проєкту.'],
    featured: true,
    cover: {
      src: '/images/projects/portrait.jpg',
      alt: 'Портрет із синім освітленням',
      format: 'portrait',
      position: '50% 42%',
    },
  },
  {
    slug: 'forma',
    title: 'Forma',
    category: 'Вебсайт',
    year: 2026,
    summary: 'Демонстраційний проєкт для студії інтер’єрів.',
    body: ['Приклад оформлення картки. Замініть цей контент власним проєктом.'],
    featured: true,
    cover: {
      src: '/images/projects/interior.jpg',
      alt: 'Світлий інтер’єр з природними матеріалами',
      format: 'landscape',
    },
  },
  {
    slug: 'prism',
    title: 'Prism',
    category: 'Артдирекція',
    year: 2026,
    summary: 'Демонстраційний проєкт з експериментальною візуальною мовою.',
    body: ['Приклад оформлення картки. Замініть цей контент власним проєктом.'],
    featured: true,
    cover: {
      src: '/images/projects/abstract.jpg',
      alt: 'Абстрактна композиція з кольоровими світловими хвилями',
      format: 'portrait',
    },
  },
  {
    slug: 'monument',
    title: 'Monument',
    category: 'Вебсайт',
    year: 2026,
    summary: 'Демонстраційний проєкт для архітектурного бюро.',
    body: ['Приклад оформлення картки. Замініть цей контент власним проєктом.'],
    featured: true,
    cover: {
      src: '/images/projects/architecture.jpg',
      alt: 'Скульптурна біла архітектура на тлі блакитного неба',
      format: 'landscape',
    },
  },
]

export function getProjectBySlug(slug: string | undefined) {
  return projects.find((project) => project.slug === slug)
}
