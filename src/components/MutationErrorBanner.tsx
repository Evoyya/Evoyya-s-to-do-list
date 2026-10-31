import { useMutationState, useQueryClient } from '@tanstack/react-query'

// Сообщает об ошибке сохранения: изменение уже откатилось на экране
export function MutationErrorBanner() {
  const queryClient = useQueryClient()
  const errors = useMutationState({
    filters: { status: 'error' },
    select: (mutation) => mutation.state.error,
  })
  const last = errors.at(-1)
  if (!last) return null

  return (
    <div
      role="alert"
      className="mx-auto mb-4 flex max-w-xl items-center justify-between gap-3 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-sm"
    >
      <span>Не удалось сохранить изменения: {last.message}</span>
      <button
        type="button"
        onClick={() => queryClient.getMutationCache().clear()}
        className="shrink-0 text-text-muted hover:text-text"
      >
        Скрыть
      </button>
    </div>
  )
}
