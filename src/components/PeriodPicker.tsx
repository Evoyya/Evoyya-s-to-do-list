import type { Period, PeriodPreset } from '../lib/archiveStats'

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
  { value: 'custom', label: 'Свой период' },
]

// ТР-10: период по дате архивации
export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period
  onChange: (period: Period) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="radiogroup"
        aria-label="Период"
        className="flex flex-wrap rounded-full bg-surface-raised p-0.5"
      >
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={value.preset === p.value}
            onClick={() => onChange({ ...value, preset: p.value })}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              value.preset === p.value
                ? 'bg-accent/20 text-accent'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {value.preset === 'custom' && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <label className="flex items-center gap-1">
            с
            <input
              type="date"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="rounded border border-border/60 bg-surface-raised px-2 py-1 text-base text-text"
            />
          </label>
          <label className="flex items-center gap-1">
            по
            <input
              type="date"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="rounded border border-border/60 bg-surface-raised px-2 py-1 text-base text-text"
            />
          </label>
        </div>
      )}
    </div>
  )
}
