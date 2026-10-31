import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ColorDot } from '../components/ColorPicker'
import { NoteCard } from '../components/NoteCard'
import { NoteComposer } from '../components/NoteComposer'
import { NoteEditor } from '../components/NoteEditor'
import { UrgencyBoard } from '../components/UrgencyBoard'
import { useItemsByNote } from '../hooks/useChecklist'
import { useLabelsFor, useMyLabels } from '../hooks/useLabels'
import { useNotes } from '../hooks/useNotes'
import type { ChecklistItem } from '../lib/checklist'
import type { Label } from '../lib/labels'
import type { Note } from '../lib/notes'

export function BoardPage() {
  const { data: notes = [], isPending, error } = useNotes()
  const itemsByNote = useItemsByNote()
  const labelsFor = useLabelsFor()
  const myLabels = useMyLabels()
  const [openedId, setOpenedId] = useState<string | null>(null)
  const opened = notes.find((n) => n.id === openedId)

  // ТР-5: фильтр по ярлыку живёт в адресе (?label=…), чтобы пережить перезагрузку
  const [params, setParams] = useSearchParams()
  const filter = myLabels.find((l) => l.id === params.get('label'))
  const setFilter = (id: string | null) => setParams(id ? { label: id } : {}, { replace: true })
  const visible = filter ? notes.filter((n) => labelsFor(n).some((l) => l.id === filter.id)) : notes

  // ТР-1: постоянные — только в закрепе, временные — только ниже
  const pinned = visible.filter((n) => n.kind === 'permanent')
  const temporary = visible.filter((n) => n.kind === 'temporary')

  return (
    // Доска шириной до 4 столбцов по центру экрана, как в Keep
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <NoteComposer />
        {myLabels.length > 0 && (
          <LabelFilter labels={myLabels} activeId={filter?.id ?? null} onChange={setFilter} />
        )}
      </div>

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
              labelsFor={labelsFor}
              onOpen={setOpenedId}
              empty={
                filter ? 'Нет постоянных заметок с этим ярлыком' : 'Постоянных заметок пока нет'
              }
            />
          </Section>
          <Section title="Задачи">
            <UrgencyBoard
              notes={temporary}
              itemsByNote={itemsByNote}
              labelsFor={labelsFor}
              onOpen={setOpenedId}
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

// Плашки «Все» и по одной на ярлык; на телефоне листаются вбок
function LabelFilter({
  labels,
  activeId,
  onChange,
}: {
  labels: Label[]
  activeId: string | null
  onChange: (id: string | null) => void
}) {
  const chip = (active: boolean) =>
    `flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
      active
        ? 'border-accent/60 bg-accent/20 text-accent'
        : 'border-border/60 text-text-muted hover:border-border hover:text-text'
    }`

  return (
    <div
      role="radiogroup"
      aria-label="Фильтр по ярлыку"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:justify-center md:px-0"
    >
      <button
        type="button"
        role="radio"
        aria-checked={activeId === null}
        onClick={() => onChange(null)}
        className={chip(activeId === null)}
      >
        Все
      </button>
      {labels.map((label) => (
        <button
          key={label.id}
          type="button"
          role="radio"
          aria-checked={activeId === label.id}
          onClick={() => onChange(activeId === label.id ? null : label.id)}
          className={chip(activeId === label.id)}
        >
          <ColorDot color={label.color} className="size-2.5" />
          {label.name}
        </button>
      ))}
    </div>
  )
}

function NoteGrid({
  notes,
  itemsByNote,
  labelsFor,
  onOpen,
  empty,
}: {
  notes: Note[]
  itemsByNote: Map<string, ChecklistItem[]>
  labelsFor: (note: Note) => Label[]
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
            labels={labelsFor(note)}
            onOpen={() => onOpen(note.id)}
          />
        </li>
      ))}
    </ul>
  )
}

const NO_ITEMS: ChecklistItem[] = []
