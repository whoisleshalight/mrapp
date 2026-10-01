import { RouterProvider } from 'react-router'
import { useState, useSyncExternalStore } from 'react'
import { router } from './router'
import Preloader from './components/Preloader/Preloader'
import { AnimationReadyContext, TransitionReadinessContext } from '../shared/animation/readiness'

const subscribe = (notify: () => void) => router.subscribe(notify)
const getReady = () => router.state.initialized || router.state.errors !== null

export default function App() {
  const ready = useSyncExternalStore(subscribe, getReady)
  const [booted, setBooted] = useState(false)
  const [transitionReady, setTransitionReady] = useState(true)
  return (
    <AnimationReadyContext value={booted && transitionReady}>
      <TransitionReadinessContext value={setTransitionReady}>
        <RouterProvider router={router} />
      </TransitionReadinessContext>
      <Preloader ready={ready} onComplete={setBooted} />
    </AnimationReadyContext>
  )
}
