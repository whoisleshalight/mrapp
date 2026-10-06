/** Let the contact video provide a first frame before taking the new snapshot. */
export function waitForContactFrame(signal: AbortSignal): Promise<void> {
  const video = document.querySelector<HTMLVideoElement>('[data-contact-video]')
  if (!video || video.readyState >= 2 || video.error || signal.aborted) return Promise.resolve()

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timeout)
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('error', finish)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    // A slow or failed film must never hold the navigation indefinitely.
    const timeout = window.setTimeout(finish, 1500)
    video.addEventListener('loadeddata', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
    signal.addEventListener('abort', finish, { once: true })
  })
}
