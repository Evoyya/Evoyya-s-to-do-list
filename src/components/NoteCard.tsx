import { useUpdateItem } from '../hooks/useChecklist'
import type { ChecklistItem } from '../lib/checklist'
import type { Note } from '../lib/notes'
import { Checkbox, doneLabel } from './Checkbox'

const MAX_VISIBLE_ITEMS = 8

export function NoteCard({
  note,
  items,
  onOpen,
}: {
  note: Note
  items: ChecklistItem[]
  onOpen: () => void
}) {
  const updateItem = useUpdateItem()
  const active = items.filter((i) => !i.is_done)
  const doneCount = items.length - active.length

  return (
    // div, а не button: внутри есть свои кнопки-чекбоксы
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      className="flex w-full cursor-pointer flex-col gap-2 rounded-lg border border-border/60 bg-surface p-4 text-left transition-colors hover:border-border"
    >
      <h3 className="font-medium break-words">{note.title}</h3>
      {/* ТР-3: пустое описание не занимает места */}
      {note.description && (
        <p className="line-clamp-6 text-sm break-words whitespace-pre-wrap text-text-muted">
          {note.description}
        </p>
      )}

      {active.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {active.slice(0, MAX_VISIBLE_ITEMS).map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={false}
                onChange={() => updateItem.mutate({ id: item.id, patch: { is_done: true } })}
                label={`Выполнено: ${item.text}`}
              />
              <span className="break-words">{item.text}</span>
            </li>
          ))}
          {active.length > MAX_VISIBLE_ITEMS && <li className="text-sm text-text-muted">…</li>}
        </ul>
      )}
      {doneCount > 0 && <p className="text-sm text-text-muted">{doneLabel(doneCount)}</p>}
    </div>
  )
}
