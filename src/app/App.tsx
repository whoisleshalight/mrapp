import { RouterProvider } from 'react-router'
import { TrackerCursor } from './components/TrackerCursor/TrackerCursor'
import { useState } from 'react'
import { router } from './router/router'
import Preloader from './components/Preloader/Preloader'
import { useInitialAssets } from './components/Preloader/useInitialAssets'
import { usePreparedLayout } from './components/Preloader/usePreparedLayout'
import { AnimationReadyContext, InitialRouteCommitContext, PageInteractiveContext, TransitionReadinessContext } from '@/shared/animation/readiness'

export default function App() {
  const [routeCommitted, setRouteCommitted] = useState(false)
  const [booted, setBooted] = useState(false)
  const [transitionReady, setTransitionReady] = useState(true)
  const assets = useInitialAssets(routeCommitted)
  const prepared = usePreparedLayout(assets.settled)
  return (
    <AnimationReadyContext value={assets.settled && transitionReady}>
      <PageInteractiveContext value={booted && transitionReady}>
        <TransitionReadinessContext value={setTransitionReady}>
          <InitialRouteCommitContext value={setRouteCommitted}>
            <TrackerCursor />
            <RouterProvider router={router} />
          </InitialRouteCommitContext>
        </TransitionReadinessContext>
        {!booted && <Preloader assets={assets} ready={prepared} onComplete={setBooted} />}
      </PageInteractiveContext>
    </AnimationReadyContext>
  )
}
