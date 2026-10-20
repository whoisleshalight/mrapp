import { useEffect, useState } from 'react'
import { waitForInitialAssets, type AssetProgress } from './initialAssets'

export function useInitialAssets(ready: boolean) {
  const [assets, setAssets] = useState<AssetProgress>({ progress: 0, settled: false })

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    // Start only after the route's scripts/styles and its DOM have committed.
    const frame = requestAnimationFrame(() => {
      void waitForInitialAssets({ signal: controller.signal, onProgress: setAssets })
    })
    return () => {
      cancelAnimationFrame(frame)
      controller.abort()
    }
  }, [ready])

  return assets
}
