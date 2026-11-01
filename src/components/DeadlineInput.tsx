// Дедлайн временной задачи — необязательный; пусто — без дедлайна.
// Системный выбор даты: на iPhone — колесо дат, на ПК — календарь.
export function DeadlineInput({
  value,
  onChange,
}: {
  value: string // «ГГГГ-ММ-ДД» или ''
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-full bg-surface py-1 pr-1 pl-3 text-sm text-text-muted">
      до
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Дедлайн"
        className="rounded-full bg-transparent px-1 text-base text-text [color-scheme:dark] outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Убрать дедлайн"
          title="Убрать дедлайн"
          className="rounded-full px-1.5 text-text-muted hover:text-text"
        >
          ✕
        </button>
      )}
    </label>
  )
}

// «до: 5 ноября»; год — только если не текущий
export function formatDeadline(date: string) {
  const d = new Date(`${date}T00:00:00`)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `до: ${d.toLocaleDateString('ru', {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })}`
}
