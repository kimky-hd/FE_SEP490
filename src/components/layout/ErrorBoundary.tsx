import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { tr } from '@/i18n'

interface Props {
  children: ReactNode
  variant?: 'page' | 'inline'
  resetKey?: unknown
}

interface State {
  error: Error | null
}

// Chunk lazy lỗi tải thường do vừa deploy bản mới (file hash cũ đã mất) — chỉ cần tải lại trang.
function isChunkLoadError(error: Error) {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    error.message,
  )
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error(error, info.componentStack)
    }
  }

  private reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const chunk = isChunkLoadError(error)
    const title = chunk
      ? tr('Ứng dụng vừa được cập nhật', 'The app has been updated')
      : tr('Đã xảy ra lỗi khi hiển thị nội dung', 'Something went wrong while rendering')
    const body = chunk
      ? tr('Tải lại trang để dùng phiên bản mới.', 'Reload the page to get the latest version.')
      : tr(
          'Bạn có thể thử lại; nếu lỗi lặp lại, hãy tải lại trang.',
          'Try again; if it keeps happening, reload the page.',
        )
    const actions = (
      <div className="mt-4 flex flex-wrap gap-2">
        {!chunk && (
          <Button variant="secondary" onClick={this.reset}>
            {tr('Thử lại', 'Try again')}
          </Button>
        )}
        <Button onClick={() => window.location.reload()}>{tr('Tải lại trang', 'Reload page')}</Button>
      </div>
    )

    if (this.props.variant === 'inline') {
      return (
        <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-900">
          <p className="font-semibold">{title}</p>
          <p className="mt-1">{body}</p>
          {actions}
        </div>
      )
    }

    return (
      <div role="alert" className="flex min-h-dvh items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md rounded-card border border-gray-200 bg-white p-6 shadow-xs">
          <h1 className="text-lg font-semibold text-gray-950">{title}</h1>
          <p className="mt-2 text-sm text-gray-600">{body}</p>
          {actions}
        </div>
      </div>
    )
  }
}
