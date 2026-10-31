import type { Note } from '../lib/notes'

export function NoteCard({ note, onOpen }: { note: Note; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-2 rounded-lg border border-border/60 bg-surface p-4 text-left transition-colors hover:border-border"
    >
      <h3 className="font-medium break-words">{note.title}</h3>
      {/* ТР-3: пустое описание не занимает места */}
      {note.description && (
        <p className="line-clamp-6 text-sm break-words whitespace-pre-wrap text-text-muted">
          {note.description}
        </p>
      )}
    </button>
  )
}
