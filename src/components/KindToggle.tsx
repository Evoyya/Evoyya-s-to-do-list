import type { NoteKind } from '../lib/notes'

const options: { value: NoteKind; label: string }[] = [
  { value: 'temporary', label: 'Временная' },
  { value: 'permanent', label: 'Постоянная' },
]

// ТР-1: переключатель типа заметки
export function KindToggle({
  value,
  onChange,
}: {
  value: NoteKind
  onChange: (kind: NoteKind) => void
}) {
  return (
    <div role="radiogroup" aria-label="Тип заметки" className="flex rounded-full bg-surface p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1 text-sm transition-colors ${
            value === option.value ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
