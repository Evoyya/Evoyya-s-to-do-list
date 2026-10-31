import { useEffect, useRef } from 'react'

// Подтверждение необратимого действия. Своё окно, а не window.confirm:
// системное окно на iPhone выглядит чужим, а встроенные браузеры его блокируют.
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // Фокус на окне, а не на кнопке: случайный Enter ничего не удалит
    dialog.focus()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onCancel()
      }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-xl border border-border bg-surface-raised p-0 text-text shadow-2xl outline-none backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-3 p-5">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-text-muted">{message}</p>
        <div className="flex justify-end gap-1 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-full bg-red-400/20 px-4 py-1.5 text-sm font-medium text-red-300 hover:bg-red-400/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
