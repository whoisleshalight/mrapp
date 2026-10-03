import { RouterProvider } from 'react-router'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { router } from './router'
import Preloader from './components/Preloader/Preloader'
import { AnimationReadyContext, PageRevealContext, TransitionReadinessContext } from '../shared/animation/readiness'

const subscribe = (notify: () => void) => router.subscribe(notify)
const getReady = () => router.state.initialized || router.state.errors !== null

export default function App() {
  const ready = useSyncExternalStore(subscribe, getReady)
  const [booted, setBooted] = useState(false)
  const [transition, setTransition] = useState({ ready: true, reveal: true })
  const setTransitionReady = useCallback((ready: boolean, reveal = true) => {
    setTransition({ ready, reveal })
  }, [])
  return (
    <AnimationReadyContext value={booted && transition.ready}>
      <PageRevealContext value={transition.reveal}>
        <TransitionReadinessContext value={setTransitionReady}>
          <RouterProvider router={router} />
        </TransitionReadinessContext>
      </PageRevealContext>
      <Preloader ready={ready} onComplete={setBooted} />
    </AnimationReadyContext>
  )
}
