import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { useEffect, useRef } from 'react'
import SiteHeader from '../../shared/components/SiteHeader/SiteHeader'
import SiteFooter from '../../shared/components/SiteFooter/SiteFooter'
import styles from './SiteLayout.module.scss'
import PageTransition from '../components/PageTransition/PageTransition'
import { useAnimationReady } from '../../shared/animation/readiness'

export default function SiteLayout() {
  const { pathname } = useLocation()
  const ready = useAnimationReady()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  useEffect(() => {
    if (ready && previousPath.current !== pathname) {
      mainRef.current?.focus({ preventScroll: true })
      previousPath.current = pathname
    }
  }, [pathname, ready])

  return (
    <div className={styles.layout}>
      <div className={styles.shell} inert={!ready} aria-busy={!ready}>
        <a className={styles.skipLink} href="#main-content">Перейти до контенту</a>
        <SiteHeader />
        <main id="main-content" ref={mainRef} tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
        <SiteFooter />
      </div>
      <ScrollRestoration />
      <PageTransition />
    </div>
  )
}
