import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState, type FormEvent, type HTMLAttributes } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeadlineInput, formatDeadline } from '../components/DeadlineInput'
import { TrashIcon } from '../components/icons'
import { NoteEditor } from '../components/NoteEditor'
import { ShapePicker, SprintIcon } from '../components/SprintIcon'
import { useToast } from '../components/Toast'
import { useSprintNotes, useSprintPlaces } from '../hooks/useNotes'
import {
  useCreateSprint,
  useDeleteSprint,
  useSprintLists,
  useUpdateSprint,
} from '../hooks/useSprints'
import type { Note } from '../lib/notes'
import {
  freeShapes,
  makeSprint,
  planLeave,
  planReorder,
  shapeLabel,
  sprintTasks,
  type Sprint,
  type SprintShape,
} from '../lib/sprints'
import { URGENCIES } from '../lib/urgency'

// ТР-12: спринты — задачи из разных столбцов срочности под одной целью
export function SprintsPage() {
  const { all, active, done, isPending, error } = useSprintLists()
  const notes = useSprintNotes()
  // Задачу доски можно открыть прямо отсюда
  const [openedId, setOpenedId] = useState<string | null>(null)
  const opened = notes.find((n) => n.id === openedId && !n.archived_at)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">Спринты</h1>
      <NewSprint sprints={all} />

      {error && <p className="text-red-400">Не удалось загрузить спринты: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}
      {!isPending && !error && active.length === 0 && (
        <p className="text-sm text-text-muted">
          Действующих спринтов нет. Создайте спринт, а затем добавьте в него задачи — в окне задачи
          или при её создании.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {active.map((sprint) => (
          <ActiveSprint
            key={sprint.id}
            sprint={sprint}
            sprints={all}
            tasks={sprintTasks(notes, sprint.id)}
            allNotes={notes}
            onOpen={setOpenedId}
          />
        ))}
      </ul>

      {done.length > 0 && (
        <details className="mt-4 border-t border-border/40 pt-4">
          <summary className="cursor-pointer py-1 text-xs font-medium tracking-wider text-text-muted uppercase select-none">
            Завершённые спринты ({done.length})
          </summary>
          <ul className="mt-3 flex flex-col gap-3">
            {done.map((sprint) => (
              <CompletedSprint
                key={sprint.id}
                sprint={sprint}
                sprints={all}
                tasks={sprintTasks(notes, sprint.id)}
              />
            ))}
          </ul>
        </details>
      )}

      {opened && <NoteEditor key={opened.id} note={opened} onClose={() => setOpenedId(null)} />}
    </div>
  )
}

type SprintFields = Pick<Sprint, 'title' | 'description' | 'due_date' | 'shape'>

// Новый спринт: свёрнут в строку, как форма новой заметки
function NewSprint({ sprints }: { sprints: Sprint[] }) {
  const { session } = useAuth()
  const createSprint = useCreateSprint()
  const [open, setOpen] = useState(false)
  const free = freeShapes(sprints)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full rounded-lg border border-border/60 bg-surface-raised px-4 py-3 text-left text-text-muted shadow hover:border-border"
      >
        Новый спринт…
      </button>
    )
  }

  return (
    <SprintForm
      free={free}
      submitLabel="Создать"
      onSubmit={(fields) => {
        createSprint.mutate(makeSprint(session!.user.id, fields))
        setOpen(false)
      }}
      onCancel={() => setOpen(false)}
    />
  )
}

// Поля спринта: название, описание, дата окончания и фигура
function SprintForm({
  initial,
  free,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SprintFields
  free: SprintShape[]
  submitLabel: string
  onSubmit: (fields: SprintFields) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [chosen, setChosen] = useState<SprintShape | null>(initial?.shape ?? null)
  // Пока фигуру не выбрали — первая свободная
  const shape = chosen && free.includes(chosen) ? chosen : (free[0] ?? null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !shape) return
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      shape,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 shadow-lg"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название спринта"
        aria-label="Название спринта"
        maxLength={100}
        className="bg-transparent px-1 py-1 text-base font-medium outline-none placeholder:text-text-muted"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание (необязательно)"
        aria-label="Описание спринта"
        rows={2}
        className="field-sizing-content min-h-12 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
      />
      {free.length > 0 ? (
        <ShapePicker value={shape} free={free} onChange={setChosen} />
      ) : (
        <p className="px-1 text-sm text-red-400">
          Все фигуры заняты действующими спринтами — завершите один из них.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DeadlineInput value={dueDate} onChange={setDueDate} />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !shape}
            className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}

function SprintHeader({ sprint, extra }: { sprint: Sprint; extra?: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <SprintIcon shape={sprint.shape} className="mt-0.5 size-7 text-text" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="font-medium break-words">{sprint.title}</h2>
        {(sprint.due_date || extra) && (
          <p className="text-sm text-text-muted">
            {[sprint.due_date && formatDeadline(sprint.due_date), extra]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        {sprint.description && (
          <p className="text-sm break-words whitespace-pre-wrap text-text-muted">
            {sprint.description}
          </p>
        )}
      </div>
    </div>
  )
}

function ActiveSprint({
  sprint,
  sprints,
  tasks,
  allNotes,
  onOpen,
}: {
  sprint: Sprint
  sprints: Sprint[]
  tasks: Note[]
  allNotes: Note[]
  onOpen: (id: string) => void
}) {
  const updateSprint = useUpdateSprint()
  const places = useSprintPlaces()
  const showToast = useToast()
  const [editing, setEditing] = useState(false)
  const doneCount = tasks.filter((t) => t.archived_at).length

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // На телефоне задача захватывается после короткого удержания, чтобы не мешать прокрутке
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = tasks.map((t) => t.id)
    const order = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    places.mutate(planReorder(allNotes, sprint.id, order))
  }

  // Завершение обратимо («Вернуть» в архиве спринтов), поэтому без подтверждения
  const complete = () => {
    updateSprint.mutate({ id: sprint.id, patch: { completed_at: new Date().toISOString() } })
    showToast('Спринт завершён', {
      label: 'Отменить',
      onClick: () => updateSprint.mutate({ id: sprint.id, patch: { completed_at: null } }),
    })
  }

  if (editing) {
    return (
      <li>
        <SprintForm
          initial={sprint}
          free={freeShapes(sprints, sprint.id)}
          submitLabel="Сохранить"
          onSubmit={(fields) => {
            updateSprint.mutate({ id: sprint.id, patch: fields })
            setEditing(false)
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface p-4">
      <div className="flex flex-wrap items-start gap-2">
        <SprintHeader
          sprint={sprint}
          extra={tasks.length > 0 ? `выполнено ${doneCount} из ${tasks.length}` : undefined}
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface-raised hover:text-text"
          >
            Изменить
          </button>
          <button
            type="button"
            onClick={complete}
            className="rounded-full bg-accent/20 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/30"
          >
            Завершить
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="text-sm text-text-muted">
          В спринте пока нет задач. Выберите этот спринт в окне задачи или при её создании.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col" aria-label={`Задачи спринта ${sprint.title}`}>
              {tasks.map((task, index) => (
                <SortableTask
                  key={task.id}
                  task={task}
                  sprint={sprint}
                  number={index + 1}
                  onOpen={task.archived_at ? undefined : () => onOpen(task.id)}
                  onRemove={() => places.mutate(planLeave(task.id))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </li>
  )
}

type TaskRowProps = {
  task: Note
  sprint: Sprint
  number: number
  onOpen?: () => void
  onRemove?: () => void
  handleProps?: HTMLAttributes<HTMLButtonElement>
}

function SortableTask(props: Omit<TaskRowProps, 'handleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 rounded bg-surface-raised shadow-lg' : undefined}
    >
      <TaskRow {...props} handleProps={{ ...attributes, ...listeners }} />
    </li>
  )
}

// Строка задачи: номер в фигуре спринта, название, столбец срочности.
// Выполненная (в архиве) — зачёркнута.
function TaskRow({ task, sprint, number, onOpen, onRemove, handleProps }: TaskRowProps) {
  const urgency = URGENCIES.find((u) => u.value === task.urgency)
  const done = !!task.archived_at
  return (
    <div className="group flex items-center gap-2 py-1">
      {handleProps && (
        <button
          type="button"
          aria-label={`Перетащить задачу ${task.title}`}
          className="w-4 shrink-0 cursor-grab touch-none text-text-muted opacity-60 group-hover:opacity-100 active:cursor-grabbing sm:opacity-0"
          {...handleProps}
        >
          ⠿
        </button>
      )}
      <SprintIcon shape={sprint.shape} number={number} className="size-7 text-text-muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="truncate text-left text-sm hover:underline"
          >
            {task.title}
          </button>
        ) : (
          <span
            className={`truncate text-sm ${done ? 'text-text-muted line-through' : ''}`}
            title={done ? 'Выполнена — в архиве' : undefined}
          >
            {task.title}
          </span>
        )}
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: urgency?.color }}
            aria-hidden="true"
          />
          {done ? 'Выполнена' : urgency?.label}
        </span>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Убрать из спринта: ${task.title}`}
          title="Убрать из спринта"
          className="shrink-0 px-2 text-lg leading-none text-text-muted opacity-60 group-hover:opacity-100 hover:text-text focus:opacity-100 sm:opacity-0"
        >
          ×
        </button>
      )}
    </div>
  )
}

function CompletedSprint({
  sprint,
  sprints,
  tasks,
}: {
  sprint: Sprint
  sprints: Sprint[]
  tasks: Note[]
}) {
  const updateSprint = useUpdateSprint()
  const deleteSprint = useDeleteSprint()
  const [deleting, setDeleting] = useState(false)
  // Фигура занята другим действующим спринтом — при возврате выбирается другая
  const [choosing, setChoosing] = useState(false)
  const free = freeShapes(sprints, sprint.id)
  const doneCount = tasks.filter((t) => t.archived_at).length
  const completedOn = new Date(sprint.completed_at!).toLocaleDateString('ru', {
    day: 'numeric',
    month: 'long',
  })

  const reopen = (shape: SprintShape) => {
    updateSprint.mutate({ id: sprint.id, patch: { completed_at: null, shape } })
    setChoosing(false)
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 p-4">
      <div className="flex flex-wrap items-start gap-2">
        <SprintHeader
          sprint={sprint}
          extra={`завершён ${completedOn} · выполнено ${doneCount} из ${tasks.length}`}
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => (free.includes(sprint.shape) ? reopen(sprint.shape) : setChoosing(true))}
            disabled={free.length === 0}
            title={free.length === 0 ? 'Все фигуры заняты действующими спринтами' : undefined}
            className="rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface-raised hover:text-text disabled:opacity-40"
          >
            Вернуть
          </button>
          <button
            type="button"
            onClick={() => setDeleting(true)}
            title="Удалить спринт"
            aria-label={`Удалить спринт ${sprint.title}`}
            className="rounded-full p-2 text-text-muted hover:bg-surface-raised hover:text-text"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {choosing && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-raised p-3">
          <p className="text-sm text-text-muted">
            Фигура «{shapeLabel(sprint.shape)}» уже занята другим спринтом. Выберите другую:
          </p>
          <ShapePicker value={null} free={free} onChange={reopen} />
        </div>
      )}

      {tasks.length > 0 && (
        <ol className="flex flex-col gap-1">
          {tasks.map((task, index) => (
            <li key={task.id} className="flex items-center gap-2 text-sm">
              <SprintIcon
                shape={sprint.shape}
                number={index + 1}
                className="size-6 text-text-muted"
              />
              <span
                className={`min-w-0 flex-1 truncate ${task.archived_at ? 'text-text-muted line-through' : ''}`}
              >
                {task.title}
              </span>
              <span className="shrink-0 text-xs text-text-muted">
                {task.archived_at ? '✓ выполнена' : 'не выполнена'}
              </span>
            </li>
          ))}
        </ol>
      )}

      {deleting && (
        <ConfirmDialog
          title="Удалить спринт?"
          message={`Спринт «${sprint.title}» будет удалён без возможности восстановления. Задачи останутся.`}
          confirmLabel="Удалить"
          onConfirm={() => {
            setDeleting(false)
            deleteSprint.mutate(sprint.id)
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </li>
  )
}
