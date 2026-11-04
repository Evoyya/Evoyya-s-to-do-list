import { useEffect, useRef, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { useSprintNotes } from '../hooks/useNotes'
import { sprintTasks, type Sprint } from '../lib/sprints'
import { URGENCIES } from '../lib/urgency'
import { formatDeadline } from './DeadlineInput'
import { SprintIcon } from './SprintIcon'

// События окна не должны доходить до карточки под ним: React передаёт их по дереву
// компонентов даже через портал, и карточка открылась бы или начала перетаскиваться
const stop = (e: SyntheticEvent) => e.stopPropagation()

// ТР-12: быстрый просмотр спринта по нажатию на значок на карточке (только с мышью).
// currentId — задача, с карточки которой открыли окно: она выделена в списке.
export function SprintDialog({
  sprint,
  currentId,
  onClose,
}: {
  sprint: Sprint
  currentId?: string
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const tasks = sprintTasks(useSprintNotes(), sprint.id)
  const doneCount = tasks.filter((t) => t.archived_at).length

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    dialog.focus()
  }, [])

  return createPortal(
    <div
      onClick={stop}
      onMouseDown={stop}
      onPointerDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
    >
      <dialog
        ref={dialogRef}
        tabIndex={-1}
        aria-label={`Спринт ${sprint.title}`}
        onCancel={(e) => {
          e.preventDefault()
          onClose()
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) onClose()
        }}
        className="m-auto max-h-[85dvh] w-[min(28rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-border bg-surface-raised p-0 text-text shadow-2xl outline-none backdrop:bg-black/60"
      >
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <SprintIcon shape={sprint.shape} className="mt-0.5 size-8 text-text" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="text-base font-medium break-words">{sprint.title}</h2>
              <p className="text-sm text-text-muted">
                {[
                  sprint.due_date && formatDeadline(sprint.due_date),
                  tasks.length > 0 && `выполнено ${doneCount} из ${tasks.length}`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          {sprint.description ? (
            <p className="text-sm break-words whitespace-pre-wrap">{sprint.description}</p>
          ) : (
            <p className="text-sm text-text-muted">Описания нет</p>
          )}

          {tasks.length > 0 && (
            <ol className="flex flex-col gap-1 border-t border-border/40 pt-3">
              {tasks.map((task, index) => {
                const urgency = URGENCIES.find((u) => u.value === task.urgency)
                const done = !!task.archived_at
                return (
                  <li
                    key={task.id}
                    className={`flex items-center gap-2 rounded px-1 py-0.5 text-sm ${
                      task.id === currentId ? 'bg-surface' : ''
                    }`}
                    aria-current={task.id === currentId ? 'true' : undefined}
                  >
                    <SprintIcon
                      shape={sprint.shape}
                      number={index + 1}
                      className="size-6 text-text-muted"
                    />
                    <span
                      className={`min-w-0 flex-1 truncate ${done ? 'text-text-muted line-through' : ''}`}
                    >
                      {task.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-text-muted">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: urgency?.color }}
                        aria-hidden="true"
                      />
                      {done ? 'Выполнена' : urgency?.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          )}

          <div className="flex justify-end gap-1 pt-1">
            <Link
              to="/sprints"
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              Все спринты
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30"
            >
              Закрыть
            </button>
          </div>
        </div>
      </dialog>
    </div>,
    document.body,
  )
}
