export function FullPageSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
    </div>
  )
}
