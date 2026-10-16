import { isRouteErrorResponse, useRouteError } from 'react-router'

export default function RouteError() {
  const error = useRouteError()
  return (
    <main style={{ padding: '2rem' }}>
      <h1>{isRouteErrorResponse(error) ? `Помилка ${error.status}` : 'Не вдалося завантажити сторінку'}</h1>
      <p>Спробуй оновити сторінку.</p>
      <a href="/">На головну</a>
    </main>
  )
}
