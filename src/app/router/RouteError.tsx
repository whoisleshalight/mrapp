import { isRouteErrorResponse, useRouteError } from 'react-router'
import { useAnimationReady, useInitialRouteCommit } from '@/shared/animation/readiness'

export default function RouteError() {
  useInitialRouteCommit()
  const ready = useAnimationReady()
  const error = useRouteError()
  return (
    <main inert={!ready} style={{ padding: '2rem' }}>
      <h1>{isRouteErrorResponse(error) ? `Помилка ${error.status}` : 'Не вдалося завантажити сторінку'}</h1>
      <p>Спробуй оновити сторінку.</p>
      <a href="/">На головну</a>
    </main>
  )
}
