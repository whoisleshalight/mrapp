import { createBrowserRouter, redirect } from 'react-router'
import SiteLayout from '@/app/layouts/SiteLayout/SiteLayout'
import RouteError from './RouteError'

export const router = createBrowserRouter([
  {
    Component: SiteLayout,
    errorElement: <RouteError />,
    // App renders the preloader while the initial lazy route loads.
    HydrateFallback: () => null,
    children: [
      { index: true, lazy: async () => ({ Component: (await import('@/pages/home/HomePage')).default }) },
      { path: 'about', lazy: async () => ({ Component: (await import('@/pages/about/AboutPage')).default }) },
      { path: 'about-us', loader: () => redirect('/about') },
      { path: 'contacts', lazy: async () => ({ Component: (await import('@/pages/contact/ContactPage')).default }) },
      { path: 'contact', lazy: async () => ({ Component: (await import('@/pages/contact/ContactPage')).default }) },
      { path: 'projects', lazy: async () => ({ Component: (await import('@/pages/projects/ProjectsPage')).default }) },
      { path: 'projects/:slug', lazy: async () => ({ Component: (await import('@/pages/project/ProjectPage')).default }) },
      { path: '*', lazy: async () => ({ Component: (await import('@/pages/not-found/NotFoundPage')).default }) },
    ],
  },
])
