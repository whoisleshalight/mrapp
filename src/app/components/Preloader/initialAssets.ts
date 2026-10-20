export type AssetProgress = { progress: number; settled: boolean }

type Options = {
  signal: AbortSignal
  onProgress: (state: AssetProgress) => void
}

/** Wait for the committed route, document load, fonts and every image on this page. */
export async function waitForInitialAssets({ signal, onProgress }: Options): Promise<void> {
  if (signal.aborted) return
  const controller = new AbortController()
  const cleanup: (() => void)[] = []
  let stopped = false
  let release: () => void = () => {}
  const cancelled = new Promise<void>((resolve) => { release = resolve })

  const stop = () => {
    stopped = true
    controller.abort()
    cleanup.forEach((dispose) => dispose())
    release()
  }
  signal.addEventListener('abort', stop, { once: true })
  cleanup.push(() => signal.removeEventListener('abort', stop))

  const waitForEvent = (element: EventTarget, event: string, isReady: () => boolean) => new Promise<void>((resolve) => {
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

  const loaded = waitForEvent(window, 'load', () => document.readyState === 'complete')
  const tasks: Promise<unknown>[] = [
    // load includes the document's scripts, stylesheets and eager resources.
    loaded,
    // Stylesheets/scripts can request more fonts before the document's load event.
    loaded.then(() => document.fonts.ready),
  ]
  for (const image of document.querySelectorAll<HTMLImageElement>('img')) {
    // Offscreen lazy images must start now, otherwise the loader would prevent scrolling to them.
    image.loading = 'eager'
    tasks.push(waitForEvent(image, 'load', () => image.complete).then(() => {
      if (!controller.signal.aborted && image.naturalWidth > 0) return image.decode().catch(() => {})
    }))
  }
  for (const video of document.querySelectorAll<HTMLVideoElement>('video')) {
    if (video.autoplay) {
      tasks.push(waitForEvent(video, 'canplay', () => video.readyState >= 3 || video.error !== null))
    }
  }

  const total = tasks.length + 1
  let completed = 1 // The lazy route's JS/CSS have loaded and React has committed its DOM.
  onProgress({ progress: Math.floor(completed / total * 100), settled: false })
  const work = Promise.allSettled(tasks.map(async (task) => {
    try { await task } finally {
      if (!stopped) {
        completed++
        onProgress({ progress: Math.floor(completed / total * 100), settled: completed === total })
      }
    }
  }))
  await Promise.race([cancelled, work])
  stop()
}
