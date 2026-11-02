import { useState, type ReactNode } from 'react'
import { CompletedItemsList } from '../components/CompletedItemsList'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ExportPanel } from '../components/ExportPanel'
import { TrashIcon, UnarchiveIcon } from '../components/icons'
import { NoteCard } from '../components/NoteCard'
import { useItemsByNote } from '../hooks/useChecklist'
import { useAuth } from '../auth/AuthProvider'
import { useCompletedItems } from '../hooks/useCompletedItems'
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
  // Выполненные пункты постоянных заметок — во второй вкладке архива
  const { data: completed = [] } = useCompletedItems()
  const [tab, setTab] = useState<'notes' | 'items'>('notes')

  // Удаление навсегда — единственное необратимое действие с заметкой, поэтому с подтверждением
  const [deleting, setDeleting] = useState<Note | null>(null)
  const [exporting, setExporting] = useState(false)
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
  // Пункты ищутся по тексту и названию заметки
  const foundItems = needle
    ? completed.filter((i) => `${i.text}\n${i.noteTitle}`.toLocaleLowerCase('ru').includes(needle))
    : completed
  const empty = notes.length === 0 && completed.length === 0

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xs font-medium tracking-wider text-text-muted uppercase">Архив</h1>
        {!empty && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => setExporting(!exporting)}
              aria-expanded={exporting}
              className="shrink-0 rounded-lg border border-border/60 px-3 py-2 text-sm text-text-muted hover:border-border hover:text-text"
            >
              Выгрузить
            </button>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск в архиве"
              aria-label="Поиск в архиве"
              className="w-full min-w-0 rounded-lg border border-border/60 bg-surface-raised px-3 py-2 text-base outline-none placeholder:text-text-muted focus:border-border sm:w-72"
            />
          </div>
        )}
      </div>
      {exporting && (
        <ExportPanel archived={notes} completed={completed} onClose={() => setExporting(false)} />
      )}

      {completed.length > 0 && (
        <div role="tablist" aria-label="Что показать" className="flex gap-1">
          {(
            [
              ['notes', 'Заметки', found.length],
              ['items', 'Пункты из списков', foundItems.length],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                tab === value
                  ? 'border-accent/60 bg-accent/20 text-accent'
                  : 'border-border/60 text-text-muted hover:border-border hover:text-text'
              }`}
            >
              {label} <span className="opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-400">Не удалось загрузить архив: {error.message}</p>}
      {isPending && <p className="text-text-muted">Загрузка…</p>}
      {!isPending && !error && empty && <p className="text-sm text-text-muted">В архиве пусто</p>}
      {needle && (tab === 'notes' ? found : foundItems).length === 0 && (
        <p className="text-sm text-text-muted">Ничего не найдено</p>
      )}

      {tab === 'items' && <CompletedItemsList items={foundItems} />}

      {/* Колонки, а не сетка: карточки разной высоты идут друг под другом без пустот, как в Keep */}
      <ul hidden={tab !== 'notes'} className="columns-2 gap-2 sm:columns-[13rem] sm:gap-3">
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
