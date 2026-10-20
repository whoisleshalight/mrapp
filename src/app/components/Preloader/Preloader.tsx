import { useRef } from 'react'
import { site } from '@/shared/config/site'
import type { AssetProgress } from './initialAssets'
import { usePreloaderMotion } from './usePreloaderMotion'
import styles from './Preloader.module.scss'

type Props = { assets: AssetProgress; ready: boolean; onComplete: (ready: boolean) => void }

export default function Preloader({ assets, ready, onComplete }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const counter = useRef<HTMLSpanElement>(null)

  usePreloaderMotion({ root, canvas, counter, assets, ready, onComplete })

  return (
    <div ref={root} className={styles.preloader} data-preloader data-phase={ready ? 'ready' : assets.settled ? 'preparing' : 'loading'}>
      <canvas ref={canvas} className={styles.scene} aria-hidden="true" />
      <div className={styles.fallback} aria-hidden="true">
        <span>{site.name}</span>
        <span>Branding · Editorial · Packaging</span>
      </div>
      <div className={styles.counter} aria-hidden="true"><span ref={counter}>0</span>%</div>
      <span className={styles.status} role="status" aria-live="polite">Завантаження сайту…</span>
    </div>
  )
}
