import type { ReactNode } from 'react'
import { useUpdateItem } from '../hooks/useChecklist'
import type { ChecklistItem } from '../lib/checklist'
import { cardStyle } from '../lib/color'
import type { Label } from '../lib/labels'
import type { Note } from '../lib/notes'
import { Checkbox, doneLabel } from './Checkbox'
import { ArchiveIcon } from './icons'
import { LabelChips } from './LabelPicker'

const MAX_VISIBLE_ITEMS = 8

export function NoteCard({
  note,
  items,
  labels = [],
  onOpen,
  actions,
  onArchive,
  compact = false,
}: {
  note: Note
  items: ChecklistItem[]
  // Ярлыки, основной первым: по нему красится карточка (ТР-5)
  labels?: Label[]
  // Без onOpen карточка не открывается (например, в архиве)
  onOpen?: () => void
  actions?: ReactNode
  // ТР-8: кнопка «В архив» в углу карточки — на ПК при наведении, на телефоне скрыта
  // (там архивируют из окна заметки, чтобы не задеть кнопку при прокрутке)
  onArchive?: () => void
  // Плотная карточка, как в архиве Keep
  compact?: boolean
}) {
  const updateItem = useUpdateItem()
  const active = items.filter((i) => !i.is_done)
  const doneCount = items.length - active.length

  return (
    // div, а не button: внутри есть свои кнопки-чекбоксы
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      style={cardStyle(labels[0]?.color)}
      onKeyDown={(e) => {
        if (onOpen && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onOpen()
        }
      }}
      className={`group relative flex w-full flex-col rounded-lg border border-border/60 bg-surface text-left transition-colors hover:border-border ${
        compact ? 'gap-1.5 px-3 pt-2.5 pb-2' : 'gap-2 p-4'
      } ${onOpen ? 'cursor-pointer' : ''}`}
    >
      <h3 className="font-medium break-words">{note.title}</h3>
      {onArchive && (
        <button
          type="button"
          title="В архив"
          aria-label={`В архив: ${note.title}`}
          onClick={(e) => {
            e.stopPropagation()
            onArchive()
          }}
          // Нажатие на кнопку не должно начинать перетаскивание карточки
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute top-2 right-2 hidden rounded-full bg-surface-raised p-1.5 text-text-muted opacity-0 shadow transition-opacity group-hover:opacity-100 hover:text-text focus-visible:opacity-100 pointer-fine:block"
        >
          <ArchiveIcon />
        </button>
      )}
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
      <LabelChips labels={labels} />
      {actions && (
        // С мышью кнопки появляются при наведении, как в Keep; на телефоне видны всегда
        <div
          className={`flex justify-end gap-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100 ${
            compact ? '-mx-1.5 -mb-1' : '-mx-2 -mb-2 pt-1'
          }`}
        >
          {actions}
        </div>
      )}
    </div>
  )
}
