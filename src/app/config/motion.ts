export const motion = {
  transitionDuration: 0.45,
  preloaderDuration: 0.5,
  assetWaitTimeout: 8000,
  ease: 'power3.inOut',
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
