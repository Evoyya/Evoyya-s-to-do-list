import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCreateLabel, useMyLabels } from '../hooks/useLabels'
import { freeColor, labelProblem, makeLabel, sameName, type Label } from '../lib/labels'
import { Checkbox } from './Checkbox'
import { ColorDot } from './ColorPicker'
import { StarIcon } from './icons'

// ТР-5: выбор ярлыков заметки и основного (по нему красится карточка).
// Можно сразу создать новый ярлык — он получит свободный цвет палитры.
export function LabelPicker({
  selected,
  primaryId,
  onToggle,
  onSetPrimary,
}: {
  selected: string[]
  // Действующий основной ярлык (уже с учётом «первый по алфавиту»)
  primaryId: string | null
  onToggle: (labelId: string, on: boolean) => void
  onSetPrimary: (labelId: string) => void
}) {
  const { session } = useAuth()
  const labels = useMyLabels()
  const createLabel = useCreateLabel()
  const [query, setQuery] = useState('')

  const shown = labels.filter((l) =>
    l.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
  )
  const canCreate = query.trim() !== '' && !labels.some((l) => sameName(l.name, query))

  const create = () => {
    const color = freeColor(labels)
    if (labelProblem(labels, query, color)) return
    const label = makeLabel(session!.user.id, query, color)
    createLabel.mutate(label)
    onToggle(label.id, true)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface p-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // Не отправлять форму создания заметки
            e.preventDefault()
            if (canCreate) create()
          }
        }}
        placeholder="Найти или создать ярлык"
        aria-label="Найти или создать ярлык"
        maxLength={50}
        className="bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
      />
      <ul className="flex max-h-56 flex-col overflow-y-auto">
        {shown.map((label) => (
          <LabelOption
            key={label.id}
            label={label}
            checked={selected.includes(label.id)}
            isPrimary={label.id === primaryId}
            // Звёздочка нужна, только когда есть из чего выбирать
            showStar={selected.length > 1 && selected.includes(label.id)}
            onToggle={(on) => onToggle(label.id, on)}
            onSetPrimary={() => onSetPrimary(label.id)}
          />
        ))}
      </ul>
      {canCreate && (
        <button
          type="button"
          onClick={create}
          className="rounded px-1 py-1.5 text-left text-sm text-accent hover:bg-surface-raised"
        >
          + Создать ярлык «{query.trim()}»
        </button>
      )}
      {labels.length === 0 && !query && (
        <p className="px-1 py-1 text-sm text-text-muted">Введите название, чтобы создать ярлык</p>
      )}
    </div>
  )
}

function LabelOption({
  label,
  checked,
  isPrimary,
  showStar,
  onToggle,
  onSetPrimary,
}: {
  label: Label
  checked: boolean
  isPrimary: boolean
  showStar: boolean
  onToggle: (on: boolean) => void
  onSetPrimary: () => void
}) {
  return (
    <li className="flex items-center gap-1">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-surface-raised">
        <Checkbox checked={checked} onChange={onToggle} label={label.name} />
        <ColorDot color={label.color} />
        <span className="truncate text-sm">{label.name}</span>
      </label>
      {showStar && (
        <button
          type="button"
          onClick={onSetPrimary}
          aria-pressed={isPrimary}
          title={isPrimary ? 'Основной ярлык: карточка в его цвете' : 'Сделать основным'}
          aria-label={`Основной ярлык: ${label.name}`}
          className={`rounded-full p-1.5 hover:bg-surface-raised ${isPrimary ? 'text-[#fbbc04]' : 'text-text-muted'}`}
        >
          <StarIcon filled={isPrimary} />
        </button>
      )}
    </li>
  )
}

// Плашки ярлыков (на карточке и в окне заметки)
export function LabelChips({ labels, onClick }: { labels: Label[]; onClick?: () => void }) {
  if (labels.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Ярлыки">
      {labels.map((label) => (
        <li key={label.id} className="flex">
          {/* На карточке плашка — просто текст: нажатие открывает заметку */}
          {onClick ? (
            <button type="button" onClick={onClick} className={CHIP}>
              {label.name}
            </button>
          ) : (
            <span className={CHIP}>{label.name}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

const CHIP = 'max-w-40 truncate rounded-full bg-text/10 px-2.5 py-0.5 text-xs text-text'
