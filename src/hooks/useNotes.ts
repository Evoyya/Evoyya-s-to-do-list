import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  byItemPosition,
  insertChecklistItems,
  makeItem,
  type ChecklistItem,
} from '../lib/checklist'
import {
  byPosition,
  deleteNote,
  fetchArchivedNotes,
  fetchNotes,
  insertNote,
  updateNote,
  type Note,
  type NoteKind,
  type NotePatch,
} from '../lib/notes'
import { useOptimisticList } from './optimistic'
import { ITEMS_KEY } from './useChecklist'

const NOTES_KEY = ['notes'] as const

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: fetchNotes })
}

export type NewNote = {
  title: string
  description: string | null
  kind: NoteKind
  items: string[]
}

// Заметка и её пункты создаются вместе: сначала заметка, потом пункты (им нужна заметка)
export function useCreateNote() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ note, items }: { note: Note; items: ChecklistItem[] }) => {
      await insertNote(note)
      await insertChecklistItems(items)
    },
    onMutate: async ({ note, items }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      await queryClient.cancelQueries({ queryKey: ITEMS_KEY })
      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEY)
      const previousItems = queryClient.getQueryData<ChecklistItem[]>(ITEMS_KEY)
      queryClient.setQueryData<Note[]>(NOTES_KEY, (old = []) => [...old, note].sort(byPosition))
      queryClient.setQueryData<ChecklistItem[]>(ITEMS_KEY, (old = []) =>
        [...old, ...items].sort(byItemPosition),
      )
      return { previousNotes, previousItems }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousNotes) queryClient.setQueryData(NOTES_KEY, context.previousNotes)
      if (context?.previousItems) queryClient.setQueryData(ITEMS_KEY, context.previousItems)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTES_KEY })
      void queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
    },
  })

  return (input: NewNote) => {
    const notes = queryClient.getQueryData<Note[]>(NOTES_KEY) ?? []
    const now = new Date().toISOString()
    const note: Note = {
      id: crypto.randomUUID(),
      owner_id: session!.user.id,
      title: input.title,
      description: input.description,
      kind: input.kind,
      urgency: 'no_deadline',
      // Новая заметка встаёт первой
      position: Math.min(0, ...notes.map((n) => n.position)) - 1,
      primary_label_id: null,
      archived_at: null,
      created_at: now,
      updated_at: now,
    }
    const items = input.items.map((text, i) => makeItem(note.id, text, i))
    mutation.mutate({ note, items })
  }
}

export function useUpdateNote() {
  return useOptimisticList<Note, { id: string; patch: NotePatch }>(
    NOTES_KEY,
    ({ id, patch }) => updateNote(id, patch),
    (notes, { id, patch }) =>
      notes
        .map((n) => (n.id === id ? { ...n, ...patch } : n))
        // Заархивированная заметка сразу уходит с доски
        .filter((n) => !n.archived_at)
        .sort(byPosition),
  )
}

// Ключ начинается с NOTES_KEY: любые изменения заметок обновляют и архив
const ARCHIVED_KEY = [...NOTES_KEY, 'archived'] as const

export function useArchivedNotes() {
  return useQuery({ queryKey: ARCHIVED_KEY, queryFn: fetchArchivedNotes })
}

export function useRestoreNote() {
  return useOptimisticList<Note, string>(
    ARCHIVED_KEY,
    (id) => updateNote(id, { archived_at: null }),
    (notes, id) => notes.filter((n) => n.id !== id),
  )
}

export function useDeleteArchivedNote() {
  return useOptimisticList<Note, string>(ARCHIVED_KEY, deleteNote, (notes, id) =>
    notes.filter((n) => n.id !== id),
  )
}
