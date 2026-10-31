import { URGENCIES, type Urgency } from '../lib/urgency'

// Выбор столбца срочности. Нативный select: на iPhone открывается удобный системный список.
export function UrgencySelect({
  value,
  onChange,
}: {
  value: Urgency
  onChange: (urgency: Urgency) => void
}) {
  const current = URGENCIES.find((u) => u.value === value)
  return (
    <label className="flex items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-3 text-sm">
      <span
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: current?.color }}
        aria-hidden="true"
      />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Urgency)}
        aria-label="Срочность"
        className="cursor-pointer bg-transparent pr-1 text-text outline-none"
      >
        {URGENCIES.map((u) => (
          <option key={u.value} value={u.value} className="bg-surface-raised">
            {u.label}
          </option>
        ))}
      </select>
    </label>
  )
}
