import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingBlock } from './PageParts'

// Suspense + boundary đặt trong layout để tab lazy đang tải / bị lỗi không làm mất sidebar và header.
export function LazyOutlet<T>({ context }: { context: T }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary variant="inline" resetKey={pathname}>
      <Suspense fallback={<LoadingBlock />}>
        <Outlet context={context} />
      </Suspense>
    </ErrorBoundary>
  )
}
