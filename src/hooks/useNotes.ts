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
import type { Urgency } from '../lib/urgency'
import { insertNoteLabels, type NoteLabel } from '../lib/labels'
import { useToast } from '../components/Toast'
import { useOptimisticList } from './optimistic'
import { ITEMS_KEY } from './useChecklist'
import { LABELS_SCOPE, NOTE_LABELS_KEY } from './useLabels'

const NOTES_KEY = ['notes'] as const

export function useNotes() {
  return useQuery({ queryKey: NOTES_KEY, queryFn: fetchNotes })
}

export type NewNote = {
  title: string
  description: string | null
  kind: NoteKind
  urgency: Urgency
  items: string[]
  labelIds: string[]
  primaryLabelId: string | null
}

// Заметка и её пункты создаются вместе: сначала заметка, потом пункты (им нужна заметка)
export function useCreateNote() {
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    // В очереди с ярлыками: ярлык, созданный прямо в форме, должен сохраниться раньше
    scope: LABELS_SCOPE,
    mutationFn: async ({
      note,
      items,
      labels,
    }: {
      note: Note
      items: ChecklistItem[]
      labels: NoteLabel[]
    }) => {
      // Основной ярлык ссылается на связь заметки с ярлыком, поэтому ставится последним
      await insertNote(note)
      await insertChecklistItems(items)
      await insertNoteLabels(labels)
      if (note.primary_label_id) {
        await updateNote(note.id, { primary_label_id: note.primary_label_id })
      }
    },
    onMutate: async ({ note, items, labels }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      await queryClient.cancelQueries({ queryKey: ITEMS_KEY })
      await queryClient.cancelQueries({ queryKey: NOTE_LABELS_KEY })
      const previousNotes = queryClient.getQueryData<Note[]>(NOTES_KEY)
      const previousItems = queryClient.getQueryData<ChecklistItem[]>(ITEMS_KEY)
      const previousLabels = queryClient.getQueryData<NoteLabel[]>(NOTE_LABELS_KEY)
      queryClient.setQueryData<Note[]>(NOTES_KEY, (old = []) => [...old, note].sort(byPosition))
      queryClient.setQueryData<ChecklistItem[]>(ITEMS_KEY, (old = []) =>
        [...old, ...items].sort(byItemPosition),
      )
      queryClient.setQueryData<NoteLabel[]>(NOTE_LABELS_KEY, (old = []) => [...old, ...labels])
      return { previousNotes, previousItems, previousLabels }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousNotes) queryClient.setQueryData(NOTES_KEY, context.previousNotes)
      if (context?.previousItems) queryClient.setQueryData(ITEMS_KEY, context.previousItems)
      if (context?.previousLabels) queryClient.setQueryData(NOTE_LABELS_KEY, context.previousLabels)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: NOTES_KEY })
      void queryClient.invalidateQueries({ queryKey: ITEMS_KEY })
      void queryClient.invalidateQueries({ queryKey: NOTE_LABELS_KEY })
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
      urgency: input.urgency,
      // Новая заметка встаёт первой
      position: Math.min(0, ...notes.map((n) => n.position)) - 1,
      primary_label_id: input.primaryLabelId,
      archived_at: null,
      created_at: now,
      updated_at: now,
    }
    const items = input.items.map((text, i) => makeItem(note.id, text, i))
    const labels = input.labelIds.map((label_id) => ({ note_id: note.id, label_id }))
    mutation.mutate({ note, items, labels })
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

export function useDeleteArchivedNote() {
  return useOptimisticList<Note, string>(ARCHIVED_KEY, deleteNote, (notes, id) =>
    notes.filter((n) => n.id !== id),
  )
}

// ТР-8: в архив и обратно. Заметка сразу переезжает между доской и архивом,
// а в уведомлении можно отменить действие.
export function useArchive() {
  const queryClient = useQueryClient()
  const showToast = useToast()

  const mutation = useMutation({
    mutationFn: ({ note, patch }: { note: Note; patch: NotePatch }) => updateNote(note.id, patch),
    onMutate: async ({ note }) => {
      await queryClient.cancelQueries({ queryKey: NOTES_KEY })
      const previousBoard = queryClient.getQueryData<Note[]>(NOTES_KEY)
      const previousArchive = queryClient.getQueryData<Note[]>(ARCHIVED_KEY)
      const without = (old: Note[] = []) => old.filter((n) => n.id !== note.id)
      if (note.archived_at) {
        queryClient.setQueryData<Note[]>(NOTES_KEY, without)
        queryClient.setQueryData<Note[]>(ARCHIVED_KEY, (old) => [note, ...without(old)])
      } else {
        queryClient.setQueryData<Note[]>(ARCHIVED_KEY, without)
        queryClient.setQueryData<Note[]>(NOTES_KEY, (old) =>
          [...without(old), note].sort(byPosition),
        )
      }
      return { previousBoard, previousArchive }
    },
    onError: (_error, _vars, context) => {
      if (context?.previousBoard) queryClient.setQueryData(NOTES_KEY, context.previousBoard)
      if (context?.previousArchive) queryClient.setQueryData(ARCHIVED_KEY, context.previousArchive)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  })

  const setArchived = (note: Note, archived: boolean, extra: NotePatch = {}) => {
    const patch = { ...extra, archived_at: archived ? new Date().toISOString() : null }
    mutation.mutate({ note: { ...note, ...patch }, patch })
    return { ...note, ...patch }
  }

  // extra — несохранённые правки из окна заметки
  const archive = (note: Note, extra?: NotePatch) => {
    const archived = setArchived(note, true, extra)
    showToast('Заметка в архиве', {
      label: 'Отменить',
      onClick: () => setArchived(archived, false),
    })
  }

  const restore = (note: Note) => {
    const restored = setArchived(note, false)
    showToast('Заметка восстановлена', {
      label: 'Отменить',
      onClick: () => setArchived(restored, true),
    })
  }

  return { archive, restore }
}
