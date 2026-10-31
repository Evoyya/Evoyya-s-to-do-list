import type { ReactNode } from 'react'
import { TrashIcon, UnarchiveIcon } from '../components/icons'
import { NoteCard } from '../components/NoteCard'
import { useItemsByNote } from '../hooks/useChecklist'
import { useArchivedNotes, useDeleteArchivedNote, useRestoreNote } from '../hooks/useNotes'
import type { ChecklistItem } from '../lib/checklist'

const NO_ITEMS: ChecklistItem[] = []

// ТР-8: архив. Восстановленная заметка возвращается в свой блок и столбец.
export function ArchivePage() {
  const { data: notes = [], isPending, error } = useArchivedNotes()
  const itemsByNote = useItemsByNote()
  const restoreNote = useRestoreNote()
  const deleteNote = useDeleteArchivedNote()

  const removeForever = (id: string, title: string) => {
    // Единственное необратимое действие в приложении, поэтому с подтверждением
    if (window.confirm(`Удалить заметку «${title}» навсегда? Восстановить её будет нельзя.`)) {
      deleteNote.mutate(id)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">Архив</h1>

      {error && <p className="text-red-400">Не удалось загрузить архив: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}
      {!isPending && !error && notes.length === 0 && (
        <p className="text-sm text-text-muted">В архиве пусто</p>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-3">
        {notes.map((note) => (
          <li key={note.id}>
            <NoteCard
              note={note}
              items={itemsByNote.get(note.id) ?? NO_ITEMS}
              actions={
                <>
                  <IconButton label="Восстановить" onClick={() => restoreNote.mutate(note.id)}>
                    <UnarchiveIcon />
                  </IconButton>
                  <IconButton
                    label="Удалить навсегда"
                    onClick={() => removeForever(note.id, note.title)}
                  >
                    <TrashIcon />
                  </IconButton>
                </>
              }
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-full p-2 text-text-muted hover:bg-surface-raised hover:text-text"
    >
      {children}
    </button>
  )
}
