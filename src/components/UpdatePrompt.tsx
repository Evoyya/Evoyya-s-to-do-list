import { useRegisterSW } from 'virtual:pwa-register/react'

const HOUR = 60 * 60 * 1000

// ТР-7: вышла новая версия приложения. Установленное приложение может быть открыто
// днями, поэтому раз в час проверяем обновления и предлагаем перезапуститься.
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), HOUR)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="mx-auto mb-4 flex max-w-xl items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm"
    >
      <span>Доступна новая версия приложения</span>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-full px-3 py-1 text-text-muted hover:text-text"
        >
          Позже
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="rounded-full bg-accent/20 px-3 py-1 font-medium text-accent hover:bg-accent/30"
        >
          Обновить
        </button>
      </div>
    </div>
  )
}
