import { createContext, useContext, useLayoutEffect } from 'react'

export const AnimationReadyContext = createContext(true)
export const TransitionReadinessContext = createContext<(ready: boolean) => void>(() => {})
export const InitialRouteCommitContext = createContext<(ready: boolean) => void>(() => {})

/** Router initialization can precede React's concurrent commit of the lazy route DOM. */
export function useInitialRouteCommit() {
  const report = useContext(InitialRouteCommitContext)
  useLayoutEffect(() => { report(true) }, [report])
}

/** Section animations wait until both the preloader and route transition have finished. */
export function useAnimationReady() {
  return useContext(AnimationReadyContext)
}
