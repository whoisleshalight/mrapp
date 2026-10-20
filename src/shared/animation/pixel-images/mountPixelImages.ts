import { ScrollTrigger } from '@/shared/animation/gsap'
import { pixelConfig as config } from './config'
import { PixelRenderer } from './PixelRenderer'

type Session = {
  image: HTMLImageElement
  renderer: PixelRenderer
  bounds: DOMRect
}

/** Only hovered and settling photos draw; at most two reusable renderers exist. */
export function mountPixelImages(root: HTMLElement) {
  const hosts = new Map<HTMLElement, HTMLImageElement>()
  root.querySelectorAll<HTMLImageElement>('[data-pixel-image]').forEach((image) => {
    if (image.parentElement) hosts.set(image.parentElement, image)
  })
  const controller = new AbortController()
  const finePointer = matchMedia('(any-hover: hover) and (any-pointer: fine)')
  const renderers = new Set<PixelRenderer>()
  const sessions = new Map<HTMLImageElement, Session>()
  let preparing: { image: HTMLImageElement; renderer: PixelRenderer; job: AbortController } | null = null
  let unavailable = false
  let hovered: HTMLImageElement | null = null
  let frame = 0
  let lastDraw = 0
  let inputVersion = 0
  let handledVersion = 0
  let x = 0
  let y = 0
  let previousX = 0
  let previousY = 0
  let velocityX = 0
  let velocityY = 0
  let pointerSeen = false

  const release = (session: Session) => {
    session.image.removeAttribute('data-pixel-active')
    session.renderer.detach()
    sessions.delete(session.image)
    visibility.unobserve(session.renderer.canvas)
    sizes.unobserve(session.image)
  }
  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    lastDraw = 0
    preparing?.job.abort()
    sessions.forEach(release)
    hovered = null
    handledVersion = inputVersion
    velocityX = velocityY = 0
  }
  const request = () => {
    if (!frame && !unavailable && !controller.signal.aborted && !document.hidden) frame = requestAnimationFrame(render)
  }
  const releasePointer = () => {
    // Scroll moves the photo, not the mouse. Preserve its displacement field
    // and stop injecting cursor velocity while the existing pixels settle.
    hovered = null
    handledVersion = inputVersion
    velocityX = velocityY = 0
    preparing?.job.abort()
  }
  const fail = () => {
    stop()
    unavailable = true
    renderers.forEach((renderer) => renderer.dispose())
    renderers.clear()
  }
  const prepare = async (image: HTMLImageElement) => {
    if (preparing) return
    let renderer = Array.from(renderers).find((candidate) =>
      !Array.from(sessions.values()).some((session) => session.renderer === candidate),
    )
    const job = new AbortController()
    try {
      if (!renderer) {
        // Queue the latest input at capacity; never truncate an outgoing grid.
        if (renderers.size >= config.maxRenderers) return
        renderer = new PixelRenderer()
        renderers.add(renderer)
        renderer.canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault()
          fail()
        }, { signal: controller.signal })
      }
      preparing = { image, renderer, job }
      await renderer.prepare(image, job.signal)
      if (job.signal.aborted || controller.signal.aborted) return
      const bounds = renderer.attach(image)
      sessions.set(image, { image, renderer, bounds })
      // Observe the overflow too, so displaced edge pixels can leave the
      // viewport naturally before this renderer returns to the pool.
      visibility.observe(renderer.canvas)
      sizes.observe(image)
    } catch {
      // Native photos remain available if WebGL, decoding or CORS is unavailable.
      if (!job.signal.aborted && !controller.signal.aborted) fail()
    } finally {
      if (preparing?.job === job) preparing = null
      if (!job.signal.aborted || hovered) request()
    }
  }
  const render = (time: number) => {
    frame = 0
    if (document.hidden || !finePointer.matches) { stop(); return }
    const delta = lastDraw ? time - lastDraw : 1000 / 60
    if (delta < 1000 / 60 - 0.1) { request(); return }
    const ratio = Math.min(2, delta / (1000 / 60))
    lastDraw = time
    const pending = inputVersion !== handledVersion
    if (pending && hovered && !sessions.has(hovered) && !preparing) void prepare(hovered)
    const current = hovered ? sessions.get(hovered) : undefined
    if (pending && current) {
      // No layout reads for outgoing photos or during the relaxation tail.
      current.bounds = current.image.getBoundingClientRect()
      velocityX = velocityX * 0.25 + (x - previousX) / ratio * 0.75
      velocityY = velocityY * 0.25 + (y - previousY) / ratio * 0.75
      previousX = x
      previousY = y
      handledVersion = inputVersion
    } else if (!hovered) handledVersion = inputVersion

    for (const session of sessions.values()) {
      const { image, renderer, bounds } = session
      if (!bounds.width || !bounds.height) { release(session); continue }
      const scale = 1 + 2 * config.overflow
      const width = bounds.width * scale
      const height = bounds.height * scale
      const mouseX = (x - bounds.left + bounds.width * config.overflow) / width
      const mouseY = (y - bounds.top + bounds.height * config.overflow) / height
      const inside = hovered === image && mouseX >= 0 && mouseX <= 1 && mouseY >= 0 && mouseY <= 1
      const moving = renderer.draw(mouseX, mouseY, inside ? velocityX / width : 0, inside ? velocityY / height : 0, ratio)
      if (!moving) { release(session); continue }
      if (!image.hasAttribute('data-pixel-active')) image.setAttribute('data-pixel-active', '')
    }
    velocityX *= Math.pow(config.velocityDecay, ratio * config.motionSpeed)
    velocityY *= Math.pow(config.velocityDecay, ratio * config.motionSpeed)
    if (sessions.size) request()
    else lastDraw = 0
  }
  const visibility = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const session = Array.from(sessions.values()).find((candidate) => candidate.renderer.canvas === entry.target)
      if (session && !entry.isIntersecting) release(session)
    })
  })
  const sizes = new ResizeObserver((entries) => {
    const scale = 1 + 2 * config.overflow
    entries.forEach((entry) => {
      const session = sessions.get(entry.target as HTMLImageElement)
      if (!session) return
      const style = session.renderer.canvas.style
      if (Math.abs(entry.contentRect.width - parseFloat(style.width) / scale) > 1 ||
        Math.abs(entry.contentRect.height - parseFloat(style.height) / scale) > 1) release(session)
    })
  })

  root.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch' || !finePointer.matches || unavailable || document.hidden) return
    // Browsers can retarget the stationary pointer as content scrolls beneath it.
    // This must not initialize another effect or inject a new displacement.
    if (pointerSeen && event.clientX === x && event.clientY === y) return
    pointerSeen = true
    let image: HTMLImageElement | null = null
    for (let node = event.target instanceof Element ? event.target : null; node && node !== root; node = node.parentElement) {
      const match = hosts.get(node as HTMLElement)
      if (match) { image = match; break }
    }
    if (image && (!image.complete || !image.naturalWidth)) image = null
    if (image !== hovered) {
      previousX = event.clientX
      previousY = event.clientY
      velocityX = velocityY = 0
      if (preparing && preparing.image !== image) preparing.job.abort()
    }
    hovered = image
    x = event.clientX
    y = event.clientY
    inputVersion++
    if (image || sessions.size) request()
  }, { passive: true, signal: controller.signal })
  root.addEventListener('pointerleave', releasePointer, { signal: controller.signal })
  // The sibling canvas follows the photo through native and smooth scrolling;
  // no extra layout reads, new renderers or grid resets are needed on scroll.
  window.addEventListener('scroll', releasePointer, { passive: true, signal: controller.signal })
  window.addEventListener('resize', stop, { passive: true, signal: controller.signal })
  window.addEventListener('blur', stop, { signal: controller.signal })
  document.addEventListener('visibilitychange', stop, { signal: controller.signal })
  finePointer.addEventListener('change', stop, { signal: controller.signal })
  ScrollTrigger.addEventListener('refreshInit', releasePointer)
  return () => {
    stop()
    controller.abort()
    visibility.disconnect()
    sizes.disconnect()
    ScrollTrigger.removeEventListener('refreshInit', releasePointer)
    renderers.forEach((renderer) => renderer.dispose())
    renderers.clear()
  }
}
