import { useRef, useState, type RefObject } from 'react'
import { useClickOutside } from '../hooks/useClickOutside'
import type { Note } from '../lib/notes'
import { Checkbox } from './Checkbox'

// ТР-11: выбор задач того же столбца, с которыми связать текущую. Можно отметить сразу несколько.
export function LinkPicker({
  candidates,
  selected,
  onToggle,
  onApply,
  onClose,
  toggleRef,
}: {
  // Действующие задачи того же столбца, кроме самой задачи и её блока
  candidates: Note[]
  selected: string[]
  onToggle: (id: string, on: boolean) => void
  // Кнопка «Связать» — в окне задачи; в форме создания выбор сохраняется вместе с задачей
  onApply?: () => void
  onClose: () => void
  toggleRef: RefObject<HTMLElement | null>
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  useClickOutside([rootRef, toggleRef], onClose)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase('ru')
  const shown = candidates.filter((n) => n.title.toLocaleLowerCase('ru').includes(needle))

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-1 rounded-lg border border-border/60 bg-surface p-2"
    >
      {candidates.length === 0 ? (
        <p className="px-1 py-1 text-sm text-text-muted">
          В этом столбце нет других задач, с которыми можно связать
        </p>
      ) : (
        <>
          {candidates.length > 6 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Не отправлять форму создания заметки
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder="Найти задачу"
              aria-label="Найти задачу"
              className="bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
            />
          )}
          <ul className="flex max-h-56 flex-col overflow-y-auto" aria-label="Задачи этого столбца">
            {shown.map((note) => (
              <li key={note.id}>
                <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-surface-raised">
                  <Checkbox
                    checked={selected.includes(note.id)}
                    onChange={(on) => onToggle(note.id, on)}
                    label={note.title}
                  />
                  <span className="truncate text-sm">{note.title}</span>
                  {note.link_group && (
                    <span className="shrink-0 text-xs text-text-muted">в блоке</span>
                  )}
                </label>
              </li>
            ))}
          </ul>
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              disabled={selected.length === 0}
              className="self-end rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
            >
              Связать{selected.length > 0 ? ` (${selected.length})` : ''}
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Строка «Связана с: …» в окне задачи и в форме создания
export function LinkedList({ titles, onUnlink }: { titles: string[]; onUnlink?: () => void }) {
  if (titles.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 text-sm">
      <span className="text-text-muted">Связана с:</span>
      {titles.map((title, i) => (
        <span
          key={i}
          className="max-w-48 truncate rounded-full bg-black/45 px-2.5 py-0.5 text-xs text-[#e8eaed]"
        >
          {title}
        </span>
      ))}
      {onUnlink && (
        <button
          type="button"
          onClick={onUnlink}
          className="rounded-full px-2.5 py-0.5 text-sm text-text-muted underline-offset-2 hover:text-text hover:underline"
        >
          Отвязать
        </button>
      )}
    </div>
  )
}
