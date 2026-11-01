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
    // div, а не label: на iPhone нажатие внутри label открывает выбор даты,
    // и крестик не срабатывал
    <div className="flex items-center rounded-full bg-surface py-0.5 pl-3 text-sm text-text-muted">
      <label className="flex items-center gap-1.5 py-0.5">
        до
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Дедлайн"
          className="rounded-full bg-transparent px-1 text-base text-text [color-scheme:dark] outline-none"
        />
      </label>
      {value ? (
        // Зона нажатия 40×40 — удобно попасть пальцем
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Убрать дедлайн"
          title="Убрать дедлайн"
          className="ml-1 flex size-10 shrink-0 items-center justify-center rounded-full text-lg text-text-muted hover:bg-surface-raised hover:text-text active:bg-surface-raised"
        >
          ✕
        </button>
      ) : (
        <span className="w-3" />
      )}
    </div>
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
