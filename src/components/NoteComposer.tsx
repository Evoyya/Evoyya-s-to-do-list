import { useState, type FormEvent } from 'react'
import { useCreateNote } from '../hooks/useNotes'
import type { NoteKind } from '../lib/notes'
import { KindToggle } from './KindToggle'

// Форма создания заметки: свёрнута в строку «Заметка…», раскрывается по нажатию
export function NoteComposer() {
  const createNote = useCreateNote()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<NoteKind>('temporary')

  const reset = () => {
    setOpen(false)
    setTitle('')
    setDescription('')
    setKind('temporary')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    createNote({ title: trimmed, description: description.trim() || null, kind })
    reset()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block w-full max-w-xl rounded-lg border border-border/60 bg-surface-raised px-4 py-3 text-left text-text-muted shadow hover:border-border"
      >
        Заметка…
      </button>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3 shadow-lg"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Название"
        aria-label="Название"
        className="bg-transparent px-1 py-1 text-base font-medium outline-none placeholder:text-text-muted"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Описание (необязательно)"
        aria-label="Описание"
        rows={2}
        className="field-sizing-content min-h-12 resize-none bg-transparent px-1 py-1 text-base outline-none placeholder:text-text-muted"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <KindToggle value={kind} onChange={setKind} />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={reset}
            className="rounded-full px-4 py-1.5 text-sm text-text-muted hover:bg-surface"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={!title.trim()}
            className="rounded-full bg-accent/20 px-4 py-1.5 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-40"
          >
            Добавить
          </button>
        </div>
      </div>
    </form>
  )
}
