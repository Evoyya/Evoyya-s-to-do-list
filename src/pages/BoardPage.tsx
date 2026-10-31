import { useState, type ReactNode } from 'react'
import { NoteCard } from '../components/NoteCard'
import { NoteComposer } from '../components/NoteComposer'
import { NoteEditor } from '../components/NoteEditor'
import { useItemsByNote } from '../hooks/useChecklist'
import { useNotes } from '../hooks/useNotes'
import type { ChecklistItem } from '../lib/checklist'
import type { Note } from '../lib/notes'

export function BoardPage() {
  const { data: notes = [], isPending, error } = useNotes()
  const itemsByNote = useItemsByNote()
  const [openedId, setOpenedId] = useState<string | null>(null)
  const opened = notes.find((n) => n.id === openedId)

  // ТР-1: постоянные — только в закрепе, временные — только ниже
  const pinned = notes.filter((n) => n.kind === 'permanent')
  const temporary = notes.filter((n) => n.kind === 'temporary')

  return (
    // Доска шириной до 4 столбцов по центру экрана, как в Keep
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <NoteComposer />

      {error && (
        <p className="text-center text-red-400">Не удалось загрузить заметки: {error.message}</p>
      )}
      {isPending && <p className="text-center text-text-muted">Загрузка…</p>}

      {!isPending && !error && (
        <>
          <Section title="Закреплённые">
            <NoteGrid
              notes={pinned}
              itemsByNote={itemsByNote}
              onOpen={setOpenedId}
              empty="Постоянных заметок пока нет"
            />
          </Section>
          {/* Столбцы срочности появятся на этапе 5 */}
          <Section title="Задачи">
            <NoteGrid
              notes={temporary}
              itemsByNote={itemsByNote}
              onOpen={setOpenedId}
              empty="Временных задач пока нет"
            />
          </Section>
        </>
      )}

      {opened && <NoteEditor key={opened.id} note={opened} onClose={() => setOpenedId(null)} />}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-xs font-medium tracking-wider text-text-muted uppercase">{title}</h2>
      {children}
    </section>
  )
}

function NoteGrid({
  notes,
  itemsByNote,
  onOpen,
  empty,
}: {
  notes: Note[]
  itemsByNote: Map<string, ChecklistItem[]>
  onOpen: (id: string) => void
  empty: string
}) {
  if (notes.length === 0) return <p className="text-sm text-text-muted">{empty}</p>
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-3">
      {notes.map((note) => (
        <li key={note.id}>
          <NoteCard
            note={note}
            items={itemsByNote.get(note.id) ?? NO_ITEMS}
            onOpen={() => onOpen(note.id)}
          />
        </li>
      ))}
    </ul>
  )
}

const NO_ITEMS: ChecklistItem[] = []
