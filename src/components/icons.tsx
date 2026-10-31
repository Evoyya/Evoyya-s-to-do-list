// Иконки в стиле Material (как в Keep), цвет берут из текста

export function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M20.54 5.23 19.15 3.55A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23A1.98 1.98 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.48-.17-.93-.46-1.27ZM6.24 5h11.52l.81.97H5.44L6.24 5ZM5 19V8h14v11H5Zm8.45-9h-2.9v3H8l4 4 4-4h-2.55v-3Z" />
    </svg>
  )
}

export function UnarchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M20.54 5.23 19.15 3.55A1.45 1.45 0 0 0 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23A1.98 1.98 0 0 0 3 6.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.5c0-.48-.17-.93-.46-1.27ZM6.24 5h11.52l.81.97H5.44L6.24 5ZM5 19V8h14v11H5Zm3-5h2.55v3h2.9v-3H16l-4-4-4 4Z" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M15 4V3H9v1H4v2h1v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1V4h-5Zm2 15H7V6h10v13ZM9 8h2v9H9V8Zm4 0h2v9h-2V8Z" />
    </svg>
  )
}
