import { useState, type ReactNode } from 'react'
import { NoteCard } from '../components/NoteCard'
import { NoteComposer } from '../components/NoteComposer'
import { NoteEditor } from '../components/NoteEditor'
import { useNotes } from '../hooks/useNotes'
import type { Note } from '../lib/notes'

export function BoardPage() {
  const { data: notes = [], isPending, error } = useNotes()
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
          <Section title="Закреплённые" empty="Постоянных заметок пока нет">
            <NoteGrid notes={pinned} onOpen={setOpenedId} />
          </Section>
          {/* Столбцы срочности появятся на этапе 5 */}
          <Section title="Задачи" empty="Временных задач пока нет">
            <NoteGrid notes={temporary} onOpen={setOpenedId} />
          </Section>
        </>
      )}

      {opened && <NoteEditor key={opened.id} note={opened} onClose={() => setOpenedId(null)} />}
    </div>
  )
}

function Section({
  title,
  empty,
  children,
}: {
  title: string
  empty: string
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="group">
      <h2 className="mb-3 text-xs font-medium tracking-wider text-text-muted uppercase">{title}</h2>
      {children}
      <p className="hidden text-sm text-text-muted group-has-[ul:empty]:block">{empty}</p>
    </section>
  )
}

function NoteGrid({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] items-start gap-3">
      {notes.map((note) => (
        <li key={note.id}>
          <NoteCard note={note} onOpen={() => onOpen(note.id)} />
        </li>
      ))}
    </ul>
  )
}
