import { useEffect, useState } from 'react'
import { motion } from '@/app/config/motion'
import { waitForInitialAssets, type AssetProgress } from './initialAssets'

export function useInitialAssets(ready: boolean) {
  const [assets, setAssets] = useState<AssetProgress>({ progress: 0, settled: false, timedOut: false })

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    // Let the committed route request its fonts and establish first-screen bounds.
    const frame = requestAnimationFrame(() => {
      void waitForInitialAssets({ signal: controller.signal, timeout: motion.assetWaitTimeout, onProgress: setAssets })
    })
    return () => {
      cancelAnimationFrame(frame)
      controller.abort()
    }
  }, [ready])

  return assets
}
