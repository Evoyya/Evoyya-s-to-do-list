import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useDeleteNote, useUpdateNote } from '../hooks/useNotes'
import type { Note, NoteKind, NotePatch } from '../lib/notes'
import { KindToggle } from './KindToggle'

// Окно редактирования. Как в Keep: закрытие (Esc, клик мимо, «Готово») сохраняет изменения.
export function NoteEditor({ note, onClose }: { note: Note; onClose: () => void }) {
  const { session } = useAuth()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [title, setTitle] = useState(note.title)
  const [description, setDescription] = useState(note.description ?? '')
  const [kind, setKind] = useState<NoteKind>(note.kind)
  const [titleError, setTitleError] = useState(false)

  const isOwner = note.owner_id === session?.user.id

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const save = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setTitleError(true)
      return
    }

    const patch: NotePatch = {}
    if (trimmed !== note.title) patch.title = trimmed
    const desc = description.trim() || null
    if (desc !== note.description) patch.description = desc
    if (kind !== note.kind) patch.kind = kind

    if (Object.keys(patch).length > 0) updateNote.mutate({ id: note.id, patch })
    onClose()
  }

  const remove = () => {
    if (!window.confirm(`Удалить заметку «${note.title}»? Это действие нельзя отменить.`)) return
    deleteNote.mutate(note.id)
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Редактирование заметки"
      onCancel={(e) => {
        e.preventDefault()
        save()
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) save()
      }}
      className="m-auto w-[min(36rem,calc(100%-2rem))] rounded-xl border border-border bg-surface-raised p-0 text-text shadow-2xl backdrop:bg-black/60"
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
          className="field-sizing-content max-h-[60dvh] min-h-16 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <KindToggle value={kind} onChange={setKind} />
          <div className="flex gap-1">
            {isOwner && (
              <button
                type="button"
                onClick={remove}
                className="rounded-full px-4 py-1.5 text-sm text-red-400 hover:bg-red-400/10"
              >
                Удалить
              </button>
            )}
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
