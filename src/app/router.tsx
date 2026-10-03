import { createBrowserRouter } from 'react-router'
import SiteLayout from './layouts/SiteLayout'
import RouteError from './layouts/RouteError'

export const router = createBrowserRouter([
  {
    Component: SiteLayout,
    errorElement: <RouteError />,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('../pages/home/HomePage')).default }) },
      { path: 'about', lazy: async () => ({ Component: (await import('../pages/about/AboutPage')).default }) },
      { path: 'contact', lazy: async () => ({ Component: (await import('../pages/contact/ContactPage')).default }) },
      { path: 'projects', lazy: async () => ({ Component: (await import('../pages/projects/ProjectsPage')).default }) },
      { path: 'projects/:slug', lazy: async () => ({ Component: (await import('../pages/project/ProjectPage')).default }) },
      { path: 'news', lazy: async () => ({ Component: (await import('../pages/news/NewsPage')).default }) },
      { path: 'news/:slug', lazy: async () => ({ Component: (await import('../pages/post/PostPage')).default }) },
      { path: '*', lazy: async () => ({ Component: (await import('../pages/not-found/NotFoundPage')).default }) },
    ],
  },
])
