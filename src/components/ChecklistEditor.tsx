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
import { useEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react'
import { useAddItem, useDeleteItem, useNoteItems, useUpdateItem } from '../hooks/useChecklist'
import { makeItem, positionBetween, type ChecklistItem } from '../lib/checklist'
import { Checkbox, doneLabel } from './Checkbox'

// ТР-4: список пунктов в окне заметки. Изменения сохраняются сразу, не дожидаясь закрытия окна.
export function ChecklistEditor({ noteId }: { noteId: string }) {
  const items = useNoteItems(noteId)
  const active = items.filter((i) => !i.is_done)
  const done = items.filter((i) => i.is_done)

  const addItem = useAddItem()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()

  const [focusId, setFocusId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // На телефоне пункт захватывается после короткого удержания, чтобы не мешать прокрутке
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const insertAfter = (index: number) => {
    const position = positionBetween(active[index]?.position, active[index + 1]?.position)
    const item = makeItem(noteId, '', position)
    addItem.mutate(item)
    setFocusId(item.id)
  }

  const removeAt = (index: number) => {
    deleteItem.mutate(active[index].id)
    setFocusId(active[index - 1]?.id ?? null)
  }

  const appendDraft = () => {
    const text = draft.trim()
    if (!text) return
    addItem.mutate(makeItem(noteId, text, positionBetween(active.at(-1)?.position, undefined)))
    setDraft('')
  }

  const handleDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    if (!over || dragged.id === over.id) return
    const from = active.findIndex((i) => i.id === dragged.id)
    const to = active.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(active, from, to)
    const position = positionBetween(reordered[to - 1]?.position, reordered[to + 1]?.position)
    updateItem.mutate({ id: String(dragged.id), patch: { position } })
  }

  const rowHandlers = (item: ChecklistItem) => ({
    onToggle: (isDone: boolean) => updateItem.mutate({ id: item.id, patch: { is_done: isDone } }),
    onCommit: (text: string) => updateItem.mutate({ id: item.id, patch: { text } }),
    onDelete: () => deleteItem.mutate(item.id),
  })

  return (
    <div className="flex flex-col gap-0.5">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={active.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {active.map((item, index) => (
            <SortableRow
              key={item.id}
              item={item}
              autoFocus={focusId === item.id}
              onFocused={() => setFocusId(null)}
              onEnter={() => insertAfter(index)}
              onBackspaceEmpty={() => removeAt(index)}
              {...rowHandlers(item)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-2 py-1 pl-6">
        <span className="w-[18px] text-center text-text-muted" aria-hidden="true">
          +
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              appendDraft()
            }
          }}
          onBlur={appendDraft}
          placeholder="Пункт списка"
          aria-label="Новый пункт списка"
          className="min-w-0 flex-1 bg-transparent py-0.5 text-base outline-none placeholder:text-text-muted"
        />
      </div>

      {done.length > 0 && (
        <details open className="mt-2 border-t border-border/40 pt-2">
          <summary className="cursor-pointer py-1 text-sm text-text-muted select-none">
            {doneLabel(done.length)}
          </summary>
          {done.map((item) => (
            <Row key={item.id} item={item} {...rowHandlers(item)} />
          ))}
        </details>
      )}
    </div>
  )
}

type RowProps = {
  item: ChecklistItem
  autoFocus?: boolean
  onFocused?: () => void
  onEnter?: () => void
  onBackspaceEmpty?: () => void
  onToggle: (isDone: boolean) => void
  onCommit: (text: string) => void
  onDelete: () => void
  handleProps?: HTMLAttributes<HTMLButtonElement>
}

function SortableRow(props: Omit<RowProps, 'handleProps'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'relative z-10 rounded bg-surface-raised shadow-lg' : undefined}
    >
      <Row {...props} handleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function Row({
  item,
  autoFocus,
  onFocused,
  onEnter,
  onBackspaceEmpty,
  onToggle,
  onCommit,
  onDelete,
  handleProps,
}: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(item.text)

  // Правка с другого устройства подтягивается, если пользователь сейчас не печатает в этом пункте
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(item.text)
  }, [item.text])

  useEffect(() => {
    if (!autoFocus) return
    inputRef.current?.focus()
    onFocused?.()
  }, [autoFocus, onFocused])

  const commit = () => {
    if (text !== item.text) onCommit(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      onEnter?.()
    } else if (e.key === 'Backspace' && text === '' && onBackspaceEmpty) {
      e.preventDefault()
      onBackspaceEmpty()
    }
  }

  return (
    <div className="group flex items-center gap-2 py-1">
      {handleProps ? (
        <button
          type="button"
          aria-label="Перетащить пункт"
          className="w-4 shrink-0 cursor-grab touch-none text-text-muted opacity-60 group-hover:opacity-100 active:cursor-grabbing sm:opacity-0"
          {...handleProps}
        >
          ⠿
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <Checkbox checked={item.is_done} onChange={onToggle} label={`Выполнено: ${item.text}`} />
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label="Текст пункта"
        className={`min-w-0 flex-1 bg-transparent py-0.5 text-base outline-none ${
          item.is_done ? 'text-text-muted line-through' : ''
        }`}
      />
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Удалить пункт ${item.text}`}
        className="shrink-0 px-1 text-lg leading-none text-text-muted opacity-60 group-hover:opacity-100 hover:text-text focus:opacity-100 sm:opacity-0"
      >
        ×
      </button>
    </div>
  )
}
