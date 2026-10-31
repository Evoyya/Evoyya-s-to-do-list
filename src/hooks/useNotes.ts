import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import {
  byPosition,
  deleteNote,
  fetchNotes,
  insertNote,
  updateNote,
  type Note,
  type NoteKind,
  type NotePatch,
} from '../lib/notes'

const NOTES_KEY = ['notes'] as const

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: fetchNotes })
}

// Изменение сразу видно на экране; при ошибке сервера список откатывается
function useOptimisticNotes<TVars>(
  mutationFn: (vars: TVars) => Promise<void>,
  apply: (notes: Note[], vars: TVars) => Note[],
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      const previous = queryClient.getQueryData<Note[]>(NOTES_KEY)
      queryClient.setQueryData<Note[]>(NOTES_KEY, (old = []) => apply(old, vars))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(NOTES_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  })
}

export type NewNote = { title: string; description: string | null; kind: NoteKind }

export function useCreateNote() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const mutation = useOptimisticNotes(insertNote, (notes, note) =>
    [...notes, note].sort(byPosition),
  )

  return (input: NewNote) => {
    const notes = queryClient.getQueryData<Note[]>(NOTES_KEY) ?? []
    const now = new Date().toISOString()
    // Новая заметка встаёт первой
    const position = Math.min(0, ...notes.map((n) => n.position)) - 1
    mutation.mutate({
      id: crypto.randomUUID(),
      owner_id: session!.user.id,
      title: input.title,
      description: input.description,
      kind: input.kind,
      urgency: 'no_deadline',
      position,
      primary_label_id: null,
      archived_at: null,
      created_at: now,
      updated_at: now,
    })
  }
}

export function useUpdateNote() {
  return useOptimisticNotes(
    ({ id, patch }: { id: string; patch: NotePatch }) => updateNote(id, patch),
    (notes, { id, patch }) =>
      notes.map((n) => (n.id === id ? { ...n, ...patch } : n)).sort(byPosition),
  )
}

export function useDeleteNote() {
  return useOptimisticNotes(deleteNote, (notes, id) => notes.filter((n) => n.id !== id))
}
