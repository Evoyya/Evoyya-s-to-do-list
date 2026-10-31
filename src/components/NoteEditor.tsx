import { useEffect, useRef, useState } from 'react'
import { useUpdateNote } from '../hooks/useNotes'
import type { Note, NoteKind, NotePatch } from '../lib/notes'
import { ChecklistEditor } from './ChecklistEditor'
import { ArchiveIcon } from './icons'
import type { Urgency } from '../lib/urgency'
import { KindToggle } from './KindToggle'
import { UrgencySelect } from './UrgencySelect'

// Окно редактирования. Как в Keep: закрытие (Esc, клик мимо, «Готово») сохраняет изменения.
export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const updateNote = useUpdateNote()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [title, setTitle] = useState(note.title)
  const [description, setDescription] = useState(note.description ?? '')
  const [kind, setKind] = useState<NoteKind>(note.kind)
  const [urgency, setUrgency] = useState<Urgency>(note.urgency)
  const [titleError, setTitleError] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    // showModal ставит фокус в первое поле, и на телефоне сразу выезжает клавиатура.
    // Фокус на самом окне: клавиатура не открывается, а Esc по-прежнему закрывает окно.
    dialog.focus()
  }, [])

  // Изменённые поля; null — если название пустое и сохранять нельзя
  const collectChanges = (): NotePatch | null => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(true)
      return null
    }
    const patch: NotePatch = {}
    if (trimmed !== note.title) patch.title = trimmed
    const desc = description.trim() || null
    if (desc !== note.description) patch.description = desc
    if (kind !== note.kind) patch.kind = kind
    if (urgency !== note.urgency) patch.urgency = urgency
    return patch
  }

  const save = () => {
    const patch = collectChanges()
    if (!patch) return
    if (Object.keys(patch).length > 0) updateNote.mutate({ id: note.id, patch })
    onClose()
  }

  // ТР-8: архивация обратима, поэтому без подтверждения
  const archive = () => {
    const patch = collectChanges() ?? {}
    updateNote.mutate({ id: note.id, patch: { ...patch, archived_at: new Date().toISOString() } })
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
      onClick={(e) => {
        if (e.target === dialogRef.current) save()
      }}
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindToggle value={kind} onChange={setKind} />
            {kind === 'temporary' && <UrgencySelect value={urgency} onChange={setUrgency} />}
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
