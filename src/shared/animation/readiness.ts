import { createContext, useContext } from 'react'

export const AnimationReadyContext = createContext(true)
export const PageRevealContext = createContext(true)
export const TransitionReadinessContext = createContext<(ready: boolean, reveal?: boolean) => void>(() => {})

/** Section animations wait until both the preloader and route transition have finished. */
export function useAnimationReady() {
  return useContext(AnimationReadyContext)
}
