import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TrashIcon, UnarchiveIcon } from '../components/icons'
import { NoteCard } from '../components/NoteCard'
import { useItemsByNote } from '../hooks/useChecklist'
import { useAuth } from '../auth/AuthProvider'
import { useLabelsFor } from '../hooks/useLabels'
import { useMembersByNote } from '../hooks/useMembers'
import { useArchive, useArchivedNotes, useDeleteArchivedNote } from '../hooks/useNotes'
import type { ChecklistItem } from '../lib/checklist'
import type { Note } from '../lib/notes'

const NO_ITEMS: ChecklistItem[] = []

// ТР-8: архив. Восстановленная заметка возвращается в свой блок и столбец.
export function ArchivePage() {
  const { data: notes = [], isPending, error } = useArchivedNotes()
  const itemsByNote = useItemsByNote()
  const labelsFor = useLabelsFor()
  const { restore } = useArchive()
  const deleteNote = useDeleteArchivedNote()

  // Удаление навсегда — единственное необратимое действие с заметкой, поэтому с подтверждением
  const [deleting, setDeleting] = useState<Note | null>(null)
  // ТР-9: владелец удаляет общую заметку у всех, участник — только у себя
  const { session } = useAuth()
  const membersByNote = useMembersByNote()
  const deleteMessage = (note: Note) => {
    if (note.owner_id !== session?.user.id) {
      return `Заметка «${note.title}» общая: она пропадёт у вас, а у создателя останется.`
    }
    const shared = (membersByNote.get(note.id)?.length ?? 1) > 1
    return `Заметка «${note.title}» будет удалена без возможности восстановления${
      shared ? ' — и у всех, с кем вы ею поделились' : ''
    }.`
  }

  // Поиск по названию, описанию и пунктам списка, без учёта регистра
  const [query, setQuery] = useState('')
  const needle = query.trim().toLocaleLowerCase('ru')
  const found = needle
    ? notes.filter((note) =>
        [note.title, note.description ?? '', ...(itemsByNote.get(note.id) ?? []).map((i) => i.text)]
          .join('\n')
          .toLocaleLowerCase('ru')
          .includes(needle),
      )
    : notes

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">Архив</h1>
        {notes.length > 0 && (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск в архиве"
            aria-label="Поиск в архиве"
            className="w-full rounded-lg border border-border/60 bg-surface-raised px-3 py-2 text-base outline-none placeholder:text-text-muted focus:border-border sm:w-72"
          />
        )}
      </div>

      {error && <p className="text-red-400">Не удалось загрузить архив: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}
      {!isPending && !error && notes.length === 0 && (
        <p className="text-sm text-text-muted">В архиве пусто</p>
      )}
      {needle && found.length === 0 && <p className="text-sm text-text-muted">Ничего не найдено</p>}

      {/* Колонки, а не сетка: карточки разной высоты идут друг под другом без пустот, как в Keep */}
      <ul className="columns-2 gap-2 sm:columns-[13rem] sm:gap-3">
        {found.map((note) => (
          <li key={note.id} className="mb-2 break-inside-avoid sm:mb-3">
            <NoteCard
              compact
              note={note}
              items={itemsByNote.get(note.id) ?? NO_ITEMS}
              view={labelsFor(note)}
              actions={
                <>
                  <IconButton label="Восстановить" onClick={() => restore(note)}>
                    <UnarchiveIcon />
                  </IconButton>
                  <IconButton label="Удалить навсегда" onClick={() => setDeleting(note)}>
                    <TrashIcon />
                  </IconButton>
                </>
              }
            />
          </li>
        ))}
      </ul>

      {deleting && (
        <ConfirmDialog
          title="Удалить навсегда?"
          message={deleteMessage(deleting)}
          confirmLabel="Удалить"
          onConfirm={() => {
            deleteNote.mutate(deleting)
            setDeleting(null)
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
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
      className="rounded-full p-1.5 text-text-muted hover:bg-surface-raised hover:text-text"
    >
      {children}
    </button>
  )
}
