import { RouterProvider } from 'react-router'
import { useEffect, useState } from 'react'
import { ScrollTrigger } from '@/shared/animation/gsap'
import { router } from './router/router'
import Preloader from './components/Preloader/Preloader'
import { AnimationReadyContext, InitialRouteCommitContext, TransitionReadinessContext } from '@/shared/animation/readiness'

export default function App() {
  const [routeCommitted, setRouteCommitted] = useState(false)
  const [booted, setBooted] = useState(false)
  const [transitionReady, setTransitionReady] = useState(true)
  useEffect(() => {
    if (!booted) return
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(frame)
  }, [booted])
  return (
    <AnimationReadyContext value={booted && transitionReady}>
      <TransitionReadinessContext value={setTransitionReady}>
        <InitialRouteCommitContext value={setRouteCommitted}>
          <RouterProvider router={router} />
        </InitialRouteCommitContext>
      </TransitionReadinessContext>
      {!booted && <Preloader ready={routeCommitted} onComplete={setBooted} />}
    </AnimationReadyContext>
  )
}
