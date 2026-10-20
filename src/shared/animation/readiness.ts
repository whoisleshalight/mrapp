import { createContext, useContext, useLayoutEffect } from 'react'

export const AnimationReadyContext = createContext(true)
export const PageInteractiveContext = createContext(true)
export const TransitionReadinessContext = createContext<(ready: boolean) => void>(() => {})
export const InitialRouteCommitContext = createContext<(ready: boolean) => void>(() => {})

/** Router initialization can precede React's concurrent commit of the lazy route DOM. */
export function useInitialRouteCommit() {
  const report = useContext(InitialRouteCommitContext)
  useLayoutEffect(() => { report(true) }, [report])
}

/** Initialize scroll effects behind the preloader once assets are ready. */
export function useAnimationReady() {
  return useContext(AnimationReadyContext)
}

/** Pointer/keyboard access remains locked until the page is actually revealed. */
export function usePageInteractive() {
  return useContext(PageInteractiveContext)
}
