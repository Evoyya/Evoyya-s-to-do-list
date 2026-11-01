import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useMembersByNote } from '../hooks/useMembers'
import type { LabelView } from '../hooks/useLabels'
import { useUpdateItem } from '../hooks/useChecklist'
import type { ChecklistItem } from '../lib/checklist'
import { cardStyle } from '../lib/color'
import { memberName } from '../lib/members'
import type { Note } from '../lib/notes'
import { Avatar } from './Avatar'
import { Checkbox, doneLabel } from './Checkbox'
import { formatDeadline } from './DeadlineInput'
import { ArchiveIcon } from './icons'
import { LabelChips } from './LabelPicker'

const MAX_VISIBLE_ITEMS = 8

export function NoteCard({
  note,
  items,
  view,
  onOpen,
  actions,
  onArchive,
  compact = false,
}: {
  note: Note
  items: ChecklistItem[]
  // Видимые ярлыки и цвет карточки (ТР-5, ТР-9)
  view?: LabelView
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
  const { session } = useAuth()
  // ТР-9: на общей заметке видны аватары остальных участников, как в Keep
  const others = (useMembersByNote().get(note.id) ?? []).filter(
    (m) => m.user_id !== session?.user.id,
  )
  const active = items.filter((i) => !i.is_done)
  const doneCount = items.length - active.length

  return (
    // div, а не button: внутри есть свои кнопки-чекбоксы
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      style={cardStyle(view?.color)}
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
      {view && <LabelChips labels={view.labels} />}
      {/* ТР-2: дедлайн — в самом низу, под ярлыками */}
      {note.kind === 'temporary' && note.due_date && (
        <p className="text-sm text-text-muted">{formatDeadline(note.due_date)}</p>
      )}
      {others.length > 0 && (
        <ul className="flex justify-end gap-1" aria-label="Участники">
          {others.map((m) => (
            <li key={m.user_id}>
              <Avatar name={memberName(m)} url={m.profile?.avatar_url} className="size-6 text-xs" />
            </li>
          ))}
        </ul>
      )}
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
