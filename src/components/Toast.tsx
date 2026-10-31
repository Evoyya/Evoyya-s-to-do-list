import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Toast = { id: number; message: string; action?: { label: string; onClick: () => void } }
type ShowToast = (message: string, action?: Toast['action']) => void

const ToastContext = createContext<ShowToast>(() => {})

const TOAST_MS = 6000

// ТР-8: уведомление внизу экрана, как в Keep («Заметка в архиве · Отменить»).
// Одновременно показывается одно: новое заменяет старое.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const nextId = useRef(0)

  const show = useCallback<ShowToast>((message, action) => {
    setToast({ id: ++nextId.current, message, action })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-start sm:px-6 sm:pb-6"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-lg bg-[#e8eaed] px-4 py-3 text-sm text-[#202124] shadow-xl sm:w-auto sm:min-w-80"
          >
            <span>{toast.message}</span>
            <div className="flex shrink-0 items-center gap-1">
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick()
                    setToast(null)
                  }}
                  className="rounded px-2 py-1 font-medium text-[#1a73e8] hover:bg-black/5"
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Закрыть уведомление"
                className="rounded px-2 py-1 text-[#5f6368] hover:bg-black/5"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </ToastContext>
  )
}

export const useToast = () => useContext(ToastContext)
