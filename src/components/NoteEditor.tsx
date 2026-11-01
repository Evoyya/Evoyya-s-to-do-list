import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  useAddNoteLabel,
  useLabelsFor,
  useRemoveNoteLabel,
  useSetPrimaryLabel,
} from '../hooks/useLabels'
import { useArchive, useUpdateNote } from '../hooks/useNotes'
import { cardStyle } from '../lib/color'
import type { Note, NoteKind, NotePatch } from '../lib/notes'
import { ChecklistEditor } from './ChecklistEditor'
import { ArchiveIcon, LabelIcon, PersonAddIcon } from './icons'
import { LabelChips, LabelPicker } from './LabelPicker'
import { MissingLabels } from './MissingLabels'
import { SharePanel } from './SharePanel'
import type { Urgency } from '../lib/urgency'
import { KindToggle } from './KindToggle'
import { UrgencySelect } from './UrgencySelect'
import { DeadlineInput } from './DeadlineInput'

// Окно редактирования. Как в Keep: закрытие (Esc, клик мимо, «Готово») сохраняет изменения.
export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const updateNote = useUpdateNote()
  const { archive: archiveNote } = useArchive()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [title, setTitle] = useState(note.title)
  const [description, setDescription] = useState(note.description ?? '')
  const [kind, setKind] = useState<NoteKind>(note.kind)
  const [urgency, setUrgency] = useState<Urgency>(note.urgency)
  const [dueDate, setDueDate] = useState(note.due_date ?? '')
  const [titleError, setTitleError] = useState(false)

  // ТР-5: ярлыки сохраняются сразу, окно перекрашивается под основной
  const { session } = useAuth()
  const view = useLabelsFor()(note)
  const labels = view.labels
  const [labelsOpen, setLabelsOpen] = useState(false)
  const labelsButtonRef = useRef<HTMLButtonElement>(null)
  // ТР-9: совместный доступ
  const [shareOpen, setShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)
  // Окно закрывается кликом по затемнению, только если и нажали, и отпустили мимо окна:
  // выделение текста, начатое внутри и законченное снаружи, окно не закрывает
  const pressedOutside = useRef(false)
  const addNoteLabel = useAddNoteLabel()
  const removeNoteLabel = useRemoveNoteLabel()
  const setPrimaryLabel = useSetPrimaryLabel()
  // На общей заметке ярлыки ставит её создатель (ТР-9)
  const canLabel = note.owner_id === session?.user.id

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // showModal ставит фокус в первое поле, и на телефоне сразу выезжает клавиатура.
    // Фокус на самом окне: клавиатура не открывается, а Esc по-прежнему закрывает окно.
    dialog.focus()
  }, [])

  // Изменённые поля; null — если название пустое и сохранять нельзя
  // Сравниваем с тем, что было при открытии, а не с текущей заметкой: если поле
  // тем временем изменили на другом устройстве, а здесь его не трогали — не затираем
  const initial = useRef(note).current
  const collectChanges = (): NotePatch | null => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(true)
      return null
    }
    const patch: NotePatch = {}
    if (trimmed !== initial.title) patch.title = trimmed
    const desc = description.trim() || null
    if (desc !== initial.description) patch.description = desc
    if (kind !== initial.kind) patch.kind = kind
    if (urgency !== initial.urgency) patch.urgency = urgency
    // У постоянной заметки дедлайна нет
    const due = kind === 'temporary' && dueDate ? dueDate : null
    if (due !== (initial.due_date ?? null)) patch.due_date = due
    return patch
  }

  const save = () => {
    const patch = collectChanges()
    if (!patch) return
    if (Object.keys(patch).length > 0) updateNote.mutate({ note, patch })
    onClose()
  }

  // ТР-8: архивация обратима, поэтому без подтверждения
  const archive = () => {
    archiveNote(note, collectChanges() ?? {})
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      aria-label="Редактирование заметки"
      onCancel={(e) => {
        e.preventDefault()
        save()
      }}
      onPointerDown={(e) => {
        pressedOutside.current = e.target === dialogRef.current
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && pressedOutside.current) save()
      }}
      style={cardStyle(view.color)}
      className="m-auto max-h-[90dvh] w-[min(36rem,calc(100%-2rem))] overflow-y-auto rounded-xl border border-border bg-surface-raised p-0 text-text shadow-2xl outline-none backdrop:bg-black/60"
    >
      <div className="flex flex-col gap-2 p-4">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setTitleError(false)
          }}
          placeholder="Название"
          aria-label="Название"
          aria-invalid={titleError}
          className="bg-transparent px-1 py-1 text-lg font-medium outline-none placeholder:text-text-muted"
        />
        {titleError && <p className="px-1 text-sm text-red-400">Название не может быть пустым</p>}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Описание (необязательно)"
          aria-label="Описание"
          rows={3}
          className="field-sizing-content max-h-[40dvh] min-h-10 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
        />
        <ChecklistEditor noteId={note.id} />
        <LabelChips labels={labels} onClick={canLabel ? () => setLabelsOpen(true) : undefined} />
        <MissingLabels missing={view.missing} />
        {labelsOpen && (
          <LabelPicker
            selected={labels.map((l) => l.id)}
            primaryId={labels[0]?.id ?? null}
            onToggle={(labelId, on) =>
              (on ? addNoteLabel : removeNoteLabel).mutate({ note_id: note.id, label_id: labelId })
            }
            onSetPrimary={(labelId) => setPrimaryLabel.mutate({ noteId: note.id, labelId })}
            onClose={() => setLabelsOpen(false)}
            toggleRef={labelsButtonRef}
          />
        )}
        {shareOpen && (
          <SharePanel
            note={note}
            onLeft={onClose}
            onClose={() => setShareOpen(false)}
            toggleRef={shareButtonRef}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindToggle value={kind} onChange={setKind} />
            {kind === 'temporary' && <UrgencySelect value={urgency} onChange={setUrgency} />}
            {kind === 'temporary' && <DeadlineInput value={dueDate} onChange={setDueDate} />}
            {canLabel && (
              <button
                ref={labelsButtonRef}
                type="button"
                onClick={() => setLabelsOpen(!labelsOpen)}
                aria-expanded={labelsOpen}
                title="Ярлыки"
                aria-label="Ярлыки"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
              >
                <LabelIcon />
                <span className="hidden sm:inline">Ярлыки</span>
              </button>
            )}
            <button
              ref={shareButtonRef}
              type="button"
              onClick={() => setShareOpen(!shareOpen)}
              aria-expanded={shareOpen}
              title="Совместный доступ"
              aria-label="Совместный доступ"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              <PersonAddIcon />
              <span className="hidden sm:inline">Доступ</span>
            </button>
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={archive}
              title="В архив"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-text-muted hover:bg-surface hover:text-text"
            >
              <ArchiveIcon />В архив
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30"
            >
              Готово
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
