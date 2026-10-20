export type AssetProgress = { progress: number; settled: boolean; timedOut: boolean }

type Options = {
  signal: AbortSignal
  timeout: number
  onProgress: (state: AssetProgress) => void
}

/** Route, fonts and first-screen media each occupy one readiness stage, not byte progress. */
export async function waitForInitialAssets({ signal, timeout, onProgress }: Options): Promise<void> {
  if (signal.aborted) return
  const controller = new AbortController()
  const cleanup: (() => void)[] = []
  let stopped = false
  let release: () => void = () => {}
  const cancelled = new Promise<void>((resolve) => { release = resolve })
  let progress = 33 // The initial route has committed.

  const stop = () => {
    stopped = true
    controller.abort()
    cleanup.forEach((dispose) => dispose())
    release()
  }
  signal.addEventListener('abort', stop, { once: true })
  cleanup.push(() => signal.removeEventListener('abort', stop))

  const visible = (element: Element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.width > 0 && bounds.height > 0 && bounds.bottom > 0 && bounds.top < window.innerHeight
      && bounds.right > 0 && bounds.left < window.innerWidth
  }
  const waitForEvent = (element: Element, event: string, isReady: () => boolean) => new Promise<void>((resolve) => {
    const finish = () => {
      element.removeEventListener(event, finish)
      element.removeEventListener('error', finish)
      controller.signal.removeEventListener('abort', finish)
      resolve()
    }
    element.addEventListener(event, finish, { once: true })
    element.addEventListener('error', finish, { once: true })
    controller.signal.addEventListener('abort', finish, { once: true })
    if (isReady()) finish()
  })

  onProgress({ progress, settled: false, timedOut: false })

  const timer = window.setTimeout(() => {
    if (stopped) return
    onProgress({ progress, settled: true, timedOut: true })
    stop()
  }, timeout)
  cleanup.push(() => window.clearTimeout(timer))

  const work = async () => {
    await document.fonts.ready.catch(() => {})
    if (stopped) return
    progress = 66
    onProgress({ progress, settled: false, timedOut: false })

    // Font substitution can move media into the viewport. Measure only after fonts settle.
    const tasks: Promise<unknown>[] = []
    for (const image of document.querySelectorAll<HTMLImageElement>('main img')) {
      if (!image.hasAttribute('data-preload') && !visible(image)) continue
      tasks.push(waitForEvent(image, 'load', () => image.complete).then(() => {
        if (!controller.signal.aborted && image.naturalWidth > 0) return image.decode().catch(() => {})
      }))
    }
    for (const video of document.querySelectorAll<HTMLVideoElement>('main video')) {
      if ((video.hasAttribute('data-preload') || visible(video)) && video.autoplay) {
        tasks.push(waitForEvent(video, 'loadeddata', () => video.readyState >= 2 || video.error !== null))
      }
    }
    if (!tasks.length) {
      progress = 100
      onProgress({ progress, settled: true, timedOut: false })
      return
    }
    let completed = 0
    await Promise.allSettled(tasks.map(async (task) => {
      try { await task } finally {
        if (!stopped) {
          completed++
          progress = 66 + Math.floor(34 * completed / tasks.length)
          onProgress({ progress, settled: completed === tasks.length, timedOut: false })
        }
      }
    }))
  }
  await Promise.race([cancelled, work()])
  stop()
}
